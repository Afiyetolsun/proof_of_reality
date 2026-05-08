// Adapted from https://github.com/mkkellogg/GaussianSplats3D/blob/main/util/create-ksplat.js
// Run from repo root (or apps/landing/) with:
//   node apps/landing/scripts/convert-splat.mjs <input.ply> <output.ksplat> [compression=1]

import * as fs from "node:fs";
import * as path from "node:path";
import * as GaussianSplats3D from "@mkkellogg/gaussian-splats-3d";
import * as THREE from "three";

const [, , inFile, outFile, compArg] = process.argv;
if (!inFile || !outFile) {
  console.error(
    "usage: node convert-splat.mjs <input.ply|.splat> <output.ksplat> [compression=1]",
  );
  process.exit(1);
}

const compressionLevel = compArg !== undefined ? parseInt(compArg, 10) : 1;
const splatAlphaRemovalThreshold = 1;
const sceneCenter = new THREE.Vector3(0, 0, 0);
const blockSize = 5.0;
const bucketSize = 256;
const outSphericalHarmonicsDegree = 0;
const sectionSize = 0;

const inAbs = path.resolve(inFile);
const outAbs = path.resolve(outFile);

console.log(`reading  ${inAbs}`);
const inBuf = fs.readFileSync(inAbs);
console.log(`  size   ${(inBuf.byteLength / 1024 / 1024).toFixed(1)} MB`);

const format = GaussianSplats3D.LoaderUtils.sceneFormatFromPath(
  inAbs.toLowerCase().trim(),
);

let splatBuffer;
if (
  format === GaussianSplats3D.SceneFormat.Ply ||
  format === GaussianSplats3D.SceneFormat.Splat
) {
  const splatArray =
    format === GaussianSplats3D.SceneFormat.Ply
      ? GaussianSplats3D.PlyParser.parseToUncompressedSplatArray(
          inBuf.buffer,
          outSphericalHarmonicsDegree,
        )
      : GaussianSplats3D.SplatParser.parseStandardSplatToUncompressedSplatArray(
          inBuf.buffer,
        );

  console.log(`  splats ${splatArray.splatCount ?? "?"}`);

  const generator = GaussianSplats3D.SplatBufferGenerator.getStandardGenerator(
    splatAlphaRemovalThreshold,
    compressionLevel,
    sectionSize,
    sceneCenter,
    blockSize,
    bucketSize,
  );
  splatBuffer = generator.generateFromUncompressedSplatArray(splatArray);
} else {
  splatBuffer = new GaussianSplats3D.SplatBuffer(inBuf.buffer);
}

console.log(`writing  ${outAbs}`);
fs.writeFileSync(outAbs, Buffer.from(splatBuffer.bufferData));
const outSize = fs.statSync(outAbs).size;
console.log(`  size   ${(outSize / 1024 / 1024).toFixed(1)} MB`);
console.log(
  `  ratio  ${((outSize / inBuf.byteLength) * 100).toFixed(1)}% of source`,
);
