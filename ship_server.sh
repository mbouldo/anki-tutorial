#!/usr/bin/env bash
set -e

node build.js --server_dir /anki-tutorial --video_dir /anki-tutorial

rm -rf build/videos
mkdir -p build/videos
cp -r videos/* build/videos/

zip -r build.zip build

scp build.zip martin@137.184.152.190:~/

rm -f build.zip
rm -rf build

echo "success"