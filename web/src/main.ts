// Entry: bring THREE + its addon loaders in from npm. The ESM THREE namespace is frozen,
// so we expose a mutable copy (spread) with the addon loaders attached as the global THREE —
// the (still-monolithic) game body reads THREE.Scene / THREE.GLTFLoader / etc. unchanged.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const T: any = { ...THREE, GLTFLoader, FBXLoader, GLTFExporter, SkeletonUtils };
(window as any).THREE = T;

import('./game.js');   // shim runs synchronously first; game body loads on the microtask
