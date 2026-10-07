import os
import tarfile
import base64
import io
import paramiko

HOST = "51.38.88.130"
PORT = 22
USER = "dev-user"
PASS = "rovnank6Duk%"

DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web_frontend", "dist")

print(f"Packaging {DIST_DIR} in memory...")
buf = io.BytesIO()
with tarfile.open(fileobj=buf, mode="w:gz") as tar:
    for root, dirs, files in os.walk(DIST_DIR):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, DIST_DIR)
            tar.add(full_path, arcname=rel_path)

tar_bytes = buf.getvalue()
b64_data = base64.b64encode(tar_bytes).decode('ascii')
print(f"Archive ready: {len(tar_bytes)} bytes (Base64: {len(b64_data)} chars)")

print(f"Connecting to {HOST}:{PORT}...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30)

print("Streaming archive directly to remote server via SSH stdin...")
cmd = "rm -rf /tmp/new_html && mkdir -p /tmp/new_html && base64 -d | tar -xz -C /tmp/new_html"
stdin, stdout, stderr = ssh.exec_command(cmd)

chunk_size = 65536
for i in range(0, len(b64_data), chunk_size):
    stdin.write(b64_data[i:i+chunk_size])
stdin.flush()
stdin.channel.shutdown_write()

exit_code = stdout.channel.recv_exit_status()
err = stderr.read().decode().strip()
if exit_code != 0:
    print(f"Error extracting archive: {err}")
    ssh.close()
    exit(1)

print("Archive extracted successfully!")

print("Updating docker container and reloading nginx...")
commands = [
    "docker cp /tmp/new_html/. smartagritech-frontend-1:/usr/share/nginx/html/",
    "docker exec smartagritech-frontend-1 nginx -s reload",
    "rm -rf /tmp/new_html"
]

for c in commands:
    stdin, stdout, stderr = ssh.exec_command(c)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if exit_code != 0:
        print(f"Error executing: {c}\nExit: {exit_code}\nStderr: {err}\nStdout: {out}")
    else:
        print(f"OK: {c}")

ssh.close()
print("Deployment completed successfully!")
