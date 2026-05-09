# USDZ -> GLB converter service.
#
# Why Blender: Apple's USDZ from RoomPlan / ObjectCapture exercises a lot
# of the USD spec (subset for ObjectCapture, big subset for RoomPlan with
# multi-material walls). Blender's USD importer is the most mature
# open-source reader. Once imported it can natively export to GLB with
# textures + materials preserved.
#
# IMPORTANT: do NOT use `apt install blender`. Ubuntu 24.04's package
# (4.0.2) is compiled WITHOUT USD support — `bpy.app.build_options.usd`
# is False, the import operator silently no-ops, and conversion fails
# with "no USD import operator available". The official LTS tarball
# from blender.org ships with the Pixar USD library bundled, which is
# the only configuration we trust here.

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV BLENDER_VERSION=4.5.0
ENV BLENDER_MAJOR=4.5

# Runtime libs Blender needs even in --background mode (it still loads
# X/GL libs to register operators). Plus tools to fetch + unpack the
# tarball and Node.js for the HTTP wrapper.
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        xz-utils \
        libxi6 libxxf86vm1 libxfixes3 libxrender1 libxkbcommon0 \
        libsm6 libxext6 libx11-6 \
        libgl1 libglx-mesa0 libegl1 \
        libtcmalloc-minimal4 \
        libfreetype6 libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

# Node 22 (matches the rest of the monorepo)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Pull official Blender LTS. Verify USD got compiled in before we move on
# — fail the build loudly here rather than silently producing an image
# that will no-op every conversion at runtime.
RUN curl -fSL "https://download.blender.org/release/Blender${BLENDER_MAJOR}/blender-${BLENDER_VERSION}-linux-x64.tar.xz" \
        -o /tmp/blender.tar.xz \
    && mkdir -p /opt/blender \
    && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1 \
    && rm /tmp/blender.tar.xz \
    && ln -s /opt/blender/blender /usr/local/bin/blender \
    && blender --version \
    && blender --background --python-expr "import bpy,sys; o=bpy.app.build_options; sys.exit(0 if (o.usd and o.io_gltf) else 1)" \
    || (echo 'FATAL: bundled Blender lacks USD or glTF support' && exit 1)

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
# `bpy.ops.wm.usd_import(...)` followed by `bpy.ops.export_scene.gltf(...)`.
CMD ["node", "server.mjs"]
