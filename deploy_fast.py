import os
import tarfile
import time
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

data = buf.getvalue()
print(f"Archive ready: {len(data)} bytes")

for attempt in range(1, 4):
    try:
        print(f"Connecting to {HOST}:{PORT} (attempt {attempt}/3)...")
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=20)

        sftp = ssh.open_sftp()
        print("Writing tar file directly on server...")
        with sftp.file("/tmp/dist.tar.gz", "wb") as f:
            f.write(data)
        sftp.close()

        print("Updating docker container...")
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
                print(f"Error executing: {cmd}\nExit: {exit_code}\nStderr: {err}\nStdout: {out}")
            else:
                print(f"OK: {cmd}")

        ssh.close()
        print("Deployment completed successfully!")
        break
    except Exception as e:
        print(f"Attempt {attempt} failed: {e}")
        time.sleep(2)
