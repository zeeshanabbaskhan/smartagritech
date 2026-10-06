import os
import tarfile
import paramiko

HOST = "51.38.88.130"
PORT = 22
USER = "dev-user"
PASS = "rovnank6Duk%"

DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web_frontend", "dist")
TAR_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist.tar.gz")

print(f"Creating tar archive from {DIST_DIR}...")
with tarfile.open(TAR_FILE, "w:gz") as tar:
    for root, dirs, files in os.walk(DIST_DIR):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, DIST_DIR)
            tar.add(full_path, arcname=rel_path)

print(f"Archive created: {os.path.getsize(TAR_FILE)} bytes")

print(f"Connecting to {HOST}:{PORT} as {USER}...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30)

print("Uploading tar archive...")
sftp = ssh.open_sftp()
sftp.put(TAR_FILE, "/tmp/dist.tar.gz")
sftp.close()

print("Extracting and updating docker container...")
commands = [
    "rm -rf /tmp/new_html && mkdir -p /tmp/new_html",
    "tar -xzf /tmp/dist.tar.gz -C /tmp/new_html",
    "docker cp /tmp/new_html/. smartagritech-frontend-1:/usr/share/nginx/html/",
    "docker exec smartagritech-frontend-1 nginx -s reload",
    "rm -f /tmp/dist.tar.gz && rm -rf /tmp/new_html"
]

for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if exit_code != 0:
        print(f"Error executing: {cmd}\nExit code: {exit_code}\nStderr: {err}\nStdout: {out}")
    else:
        print(f"OK: {cmd}")

ssh.close()
if os.path.exists(TAR_FILE):
    os.remove(TAR_FILE)
print("Deployment completed successfully!")
