# USDZ -> GLB converter service.
#
# Why Blender: Apple's USDZ from RoomPlan / ObjectCapture exercises a lot
# of the USD spec (subset for ObjectCapture, big subset for RoomPlan with
# multi-material walls). Blender's USD importer is the most mature
# open-source reader. Once imported it can natively export to GLB with
# textures + materials preserved.
#
# Image is large (~2 GB) but pulled once. Conversions are fast: <5s for
# typical Object Capture, ~10s for a full RoomPlan room.

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Blender from the official Ubuntu repo (4.0.x). Newer Blender supports
# more USD features but apt is reliable for hackathon scope. If you need
# Blender 4.2+ for a particularly weird USDZ, swap to the snap install
# or download the official tarball — see infra/converter/README.md.
RUN apt-get update && apt-get install -y --no-install-recommends \
    blender \
    curl \
    ca-certificates \
    xz-utils \
    libxi6 libxxf86vm1 libxfixes3 libxrender1 libgl1 libglx-mesa0 libegl1 \
    && rm -rf /var/lib/apt/lists/*

# Node 22 (matches the rest of the monorepo)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.mjs convert.py ./

# Persistent cache (USDZ ref → GLB ref mapping) lives in /data so it
# survives container restarts.
RUN mkdir -p /data && chmod 777 /data
VOLUME ["/data"]

EXPOSE 8082

# Headless Blender needs no display; the script we feed it does
# `bpy.ops.import_scene.usd(...)` followed by `bpy.ops.export_scene.gltf(...)`.
CMD ["node", "server.mjs"]
