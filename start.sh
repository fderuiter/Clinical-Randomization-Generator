#!/bin/bash
pnpm start > dev_server.log 2>&1 &
echo $! > server_pid.txt
