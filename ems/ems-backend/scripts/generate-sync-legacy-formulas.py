#!/usr/bin/env python3
"""Generate sync-legacy-formulas-fleet.sql from legacy SQL Server ControlFormula (read-only export)."""
import os
import re
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    print('pip install paramiko', file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'scripts' / 'sync-legacy-formulas-fleet.sql'
HOST, USER = '51.38.88.130', 'dev-user'
PWD = os.environ.get('SSH_PASS')
if not PWD:
    sys.exit('Set SSH_PASS to run legacy formula export')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PWD, timeout=30, look_for_keys=False, allow_agent=False)

def run(cmd, t=300):
    _, o, e = c.exec_command(cmd, timeout=t)
    return (o.read() + e.read()).decode('utf-8', 'replace')

def sql_legacy(q):
    qline = ' '.join(q.split())
    return run(
        "docker run --rm --network host mcr.microsoft.com/mssql-tools "
        f"/opt/mssql-tools/bin/sqlcmd -S 127.0.0.1 -U sa -P 'PnRebMoykewk4' -d db_cfsmarttech -C "
        f'-Q "{qline}" -s \'|\' -W -h-1 2>&1'
    )

def psql(q):
    return run('docker exec smartagritech-postgres-1 psql -U ems -d ems -t -A -F "|" -c "' + q.replace('"', '\\"') + '"')

def norm(s):
    return re.sub(r'[^A-Z0-9]', '', (s or '').upper())

def reg_variants(reg):
    out = set()
    s = str(reg or '').strip()
    if not s:
        return out
    out.add(s)
    if s.isdigit():
        n = int(s)
        if n < 40000:
            out.add(str(40000 + n))
        else:
            out.add(str(n - 40000))
    return out

ALIASES = {
    norm('CF SMART TECHNOLOGIES MONITORING SYSTEM'): norm('CFSMARTTECHNOLOGIESMONITORINGSYSTEM'),
    norm('FICO EV'): norm('FICOEV'),
    norm('JAPAN ELECTRONICS'): norm('JAPANELECTRONICS'),
    norm('SUPRA STEEL FURNACE'): norm('SUPRASTEELFURNACE'),
}

def leg_formula(f):
    if not f or not str(f).strip():
        return None
    f = str(f).strip()
    if f.upper() in ('NULL', 'NONE', '-', 'N/A', '0'):
        return None
    f = f.replace('%s', 's')
    if f.upper().replace(' ', '') in ('=NULL', 'NULL'):
        return None
    return f if f.startswith('=') else '=' + f

def parse(text, n):
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line or (line.startswith('(') and 'rows' in line):
            continue
        p = line.split('|')
        if len(p) >= n:
            rows.append(p)
    return rows

legacy = {}
reg_only = {}
for p in parse(sql_legacy("""
SELECT dt.Name, ts.SlaveName, tv.RegisterAddress, tv.VariableName, tv.ControlFormula, tv.AcquisitionFormula
FROM tblDeviceTemplateVariable tv
JOIN tblDeviceTemplateSlave ts ON ts.Id=tv.TemplateSlaveId
JOIN tblDeviceTemplate dt ON dt.Id=ts.TemplateId
"""), 6):
    tn = ALIASES.get(norm(p[0]), norm(p[0]))
    sn = norm(p[1])
    cf = (p[4].strip() or p[5].strip())
    f = leg_formula(cf)
    if not f:
        continue
    meta = (f, p[0].strip(), p[1].strip(), p[2].strip(), p[3].strip())
    for rv in reg_variants(p[2].strip()):
        legacy[(tn, sn, rv)] = meta
        reg_only.setdefault((tn, rv), set()).add(f)

reg_unique = {k: next(iter(v)) for k, v in reg_only.items() if len(v) == 1}

FICO_FURNACE_THD_REGS = {'40327', '40328', '40329', '40330', '40331', '40332'}

def is_fico_furnace_slave_thd(template_name, slave_name, register):
    tn = norm(template_name.replace('MQTT · ', '').replace('MQTT - ', ''))
    if 'FICOFURNACE' not in tn:
        return False
    return norm(slave_name) == norm('Fico Furnace') and str(register).strip() in FICO_FURNACE_THD_REGS

new_vars = parse(psql("""
SELECT dt.name, ts.name, tv."registerAddress", tv.name,
       COALESCE(tv."controlFormula",''), tv.id::text
FROM device_template_variables tv
JOIN device_template_slaves ts ON ts.id=tv."templateSlaveId"
JOIN device_templates dt ON dt.id=ts."templateId"
"""), 6)

updates = []
seen_ids = set()
for p in new_vars:
    dt, slave, reg, vname, cur, vid = [x.strip() for x in p]
    if is_fico_furnace_slave_thd(dt, slave, reg):
        continue
    tn = norm(dt.replace('MQTT · ', '').replace('MQTT - ', ''))
    sn = norm(slave)
    hit = None
    for rv in reg_variants(reg):
        if (tn, sn, rv) in legacy:
            hit = legacy[(tn, sn, rv)]
            break
    if not hit:
        for rv in reg_variants(reg):
            if (tn, rv) in reg_unique:
                f = reg_unique[(tn, rv)]
                hit = (f, dt, slave, reg, vname)
                break
    if not hit:
        continue
    f, lt, ls, lr, lv = hit
    if cur == f or vid in seen_ids:
        continue
    seen_ids.add(vid)
    f_sql = f.replace("'", "''")
    updates.append({
        'sql': f'UPDATE device_template_variables SET "controlFormula" = \'{f_sql}\' WHERE id = \'{vid}\';',
        'comment': f'-- {lt} | {ls} | reg {lr} | {vname} (was: {cur or "empty"})',
        'template': dt,
    })

# Fico Furnace slave: legacy hides THD — clear formulas on those registers
for line in parse(psql("""
SELECT tv.id::text, tv."registerAddress", tv."controlFormula"
FROM device_template_variables tv
JOIN device_template_slaves ts ON ts.id=tv."templateSlaveId"
JOIN device_templates dt ON dt.id=ts."templateId"
WHERE dt.name ILIKE '%Fico Furnace%' AND ts.name='Fico Furnace'
AND tv."registerAddress" IN ('40327','40328','40329','40330','40331','40332')
"""), 3):
    vid, reg, cur = [x.strip() for x in line]
    if vid in seen_ids:
        continue
    seen_ids.add(vid)
    updates.append({
        'sql': f'UPDATE device_template_variables SET "controlFormula" = NULL, "acquisitionFormula" = NULL WHERE id = \'{vid}\';',
        'comment': f'-- Fico Furnace slave THD reg {reg} cleared (legacy hides tab; was: {cur or "empty"})',
        'template': 'MQTT · Fico Furnace',
    })

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('-- Fleet formula sync: legacy ControlFormula -> controlFormula\n')
    f.write('-- Generated by generate-sync-legacy-formulas.py\n\n')
    for u in updates:
        f.write(u['comment'] + '\n')
        f.write(u['sql'] + '\n')
    f.write(f'\n-- Total template updates: {len(updates)}\n')

print(f'Wrote {len(updates)} updates to {OUT}')
c.close()
