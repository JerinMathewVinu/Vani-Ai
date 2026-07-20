"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export type HippoState = "idle" | "listening" | "thinking" | "speaking" | "positive" | "encouraging";

interface BabyHippo3DProps {
  state: HippoState;
  audioVolume?: number;
  className?: string;
  /** Eyes follow the cursor and the hippo reacts to hover/click. Default true. */
  interactive?: boolean;
  /** Called when the user clicks/taps the hippo — hook up a sound effect, a "pets" counter, etc. */
  onPoke?: () => void;
  /** Bump this number (e.g. lastCorrectAnswer + 1) to fire a one-off confetti burst regardless of state. */
  celebrateTrigger?: number;
}

export function BabyHippo3D({
  state,
  audioVolume = 0,
  className = "",
  interactive = true,
  onPoke,
  celebrateTrigger,
}: BabyHippo3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HippoState>(state);
  const volumeRef = useRef<number>(audioVolume);
  const interactiveRef = useRef<boolean>(interactive);
  const onPokeRef = useRef<(() => void) | undefined>(onPoke);
  const triggerBurstFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    volumeRef.current = audioVolume;
  }, [audioVolume]);

  useEffect(() => {
    interactiveRef.current = interactive;
  }, [interactive]);

  useEffect(() => {
    onPokeRef.current = onPoke;
  }, [onPoke]);

  useEffect(() => {
    if (celebrateTrigger === undefined) return;
    triggerBurstFnRef.current?.();
  }, [celebrateTrigger]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 340;
    const height = container.clientHeight || 340;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 0.15, 5.0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.appendChild(renderer.domElement);
    renderer.domElement.style.cursor = "pointer";
    renderer.domElement.style.touchAction = "none";

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.9);
    dirLight.position.set(3, 5, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const pinkFillLight = new THREE.PointLight(0xf472b6, 2.0, 10);
    pinkFillLight.position.set(-3, 1.5, 2.5);
    scene.add(pinkFillLight);

    const cyanRimLight = new THREE.DirectionalLight(0x818cf8, 1.4);
    cyanRimLight.position.set(0, -2, -3);
    scene.add(cyanRimLight);

    // soft top light so the glossy clearcoat picks up a gentle highlight
    const topLight = new THREE.PointLight(0xffffff, 0.9, 8);
    topLight.position.set(0, 3, 1.5);
    scene.add(topLight);

    const hippoGroup = new THREE.Group();
    hippoGroup.position.set(0, -0.15, 0);
    scene.add(hippoGroup);

    const skinMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xc7b5f4,
      roughness: 0.34,
      metalness: 0.02,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
    });

    const browMaterial = new THREE.MeshStandardMaterial({
      color: 0x9d87d6,
      roughness: 0.4,
    });

    const innerEarMaterial = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      roughness: 0.45,
    });

    const snoutMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xe3d7ff,
      roughness: 0.32,
      clearcoat: 0.3,
      clearcoatRoughness: 0.3,
    });

    const eyeWhiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.08,
    });

    const eyePupilMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2350,
      roughness: 0.05,
    });

    const eyeHighlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    const cheekMaterial = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      roughness: 0.6,
      transparent: true,
      opacity: 0.65,
    });

    const mouthInsideMaterial = new THREE.MeshStandardMaterial({
      color: 0x9f1239,
      roughness: 0.4,
    });

    const smileMaterial = new THREE.MeshStandardMaterial({
      color: 0xb3477a,
      roughness: 0.4,
    });

    const tongueMaterial = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      roughness: 0.25,
    });

    const bellyMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1ebff,
      roughness: 0.45,
    });

    const starMaterial = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.2,
      metalness: 0.5,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.5,
    });

    const bodyGeo = new THREE.SphereGeometry(0.78, 32, 32);
    bodyGeo.scale(1, 1.02, 0.95);
    const bodyMesh = new THREE.Mesh(bodyGeo, skinMaterial);
    bodyMesh.position.y = -0.35;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    hippoGroup.add(bodyMesh);

    const bellyGeo = new THREE.SphereGeometry(0.58, 32, 32);
    bellyGeo.scale(0.85, 0.92, 0.35);
    const bellyMesh = new THREE.Mesh(bellyGeo, bellyMaterial);
    bellyMesh.position.set(0, -0.36, 0.6);
    hippoGroup.add(bellyMesh);

    // stubby feet peeking out from under the body — reads as "sitting" and cute
    const footGeo = new THREE.SphereGeometry(0.17, 18, 18);
    footGeo.scale(1, 0.5, 1.05);
    const leftFoot = new THREE.Mesh(footGeo, skinMaterial);
    leftFoot.position.set(-0.34, -1.06, 0.42);
    leftFoot.castShadow = true;
    hippoGroup.add(leftFoot);

    const rightFoot = leftFoot.clone();
    rightFoot.position.x = 0.34;
    hippoGroup.add(rightFoot);

    const padGeo = new THREE.SphereGeometry(0.07, 12, 12);
    padGeo.scale(1, 0.4, 1);
    const leftPad = new THREE.Mesh(padGeo, innerEarMaterial);
    leftPad.position.set(-0.34, -0.995, 0.66);
    hippoGroup.add(leftPad);
    const rightPad = leftPad.clone();
    rightPad.position.x = 0.34;
    hippoGroup.add(rightPad);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.48, 0.08);
    hippoGroup.add(headGroup);

    // slightly bigger head relative to body = baby-schema cuteness
    const headGeo = new THREE.SphereGeometry(0.78, 32, 32);
    headGeo.scale(1.1, 0.98, 1);
    const headMesh = new THREE.Mesh(headGeo, skinMaterial);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    const browGeo = new THREE.SphereGeometry(0.075, 14, 14);
    browGeo.scale(1.9, 0.5, 0.6);
    const leftBrow = new THREE.Mesh(browGeo, browMaterial);
    leftBrow.position.set(-0.32, 0.4, 0.64);
    headGroup.add(leftBrow);
    const rightBrow = leftBrow.clone();
    rightBrow.position.x = 0.32;
    headGroup.add(rightBrow);

    const snoutGroup = new THREE.Group();
    snoutGroup.position.set(0, -0.18, 0.52);
    headGroup.add(snoutGroup);

    const snoutGeo = new THREE.SphereGeometry(0.42, 32, 32);
    snoutGeo.scale(1.24, 0.68, 0.82);
    const snoutMesh = new THREE.Mesh(snoutGeo, snoutMaterial);
    snoutMesh.castShadow = true;
    snoutGroup.add(snoutMesh);

    const nostrilGeo = new THREE.SphereGeometry(0.05, 16, 16);
    nostrilGeo.scale(1, 1.3, 0.6);
    const leftNostril = new THREE.Mesh(nostrilGeo, innerEarMaterial);
    leftNostril.position.set(-0.14, 0.09, 0.34);
    leftNostril.rotation.z = -0.15;
    snoutGroup.add(leftNostril);

    const rightNostril = leftNostril.clone();
    rightNostril.position.x = 0.14;
    rightNostril.rotation.z = 0.15;
    snoutGroup.add(rightNostril);

    // resting smile — a curved tube drawn straight onto the snout surface, independent
    // of the jaw so the hippo has a cute default expression even with its mouth closed
    const smileCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.15, 0.03, 0),
      new THREE.Vector3(0, -0.09, 0.035),
      new THREE.Vector3(0.15, 0.03, 0)
    );
    const smileGeo = new THREE.TubeGeometry(smileCurve, 20, 0.016, 8, false);
    const smileMesh = new THREE.Mesh(smileGeo, smileMaterial);
    smileMesh.position.set(0, -0.03, 0.4);
    snoutGroup.add(smileMesh);

    const jawGroup = new THREE.Group();
    jawGroup.position.set(0, -0.12, 0.16);
    snoutGroup.add(jawGroup);

    const mouthInsideGeo = new THREE.SphereGeometry(0.2, 24, 24);
    mouthInsideGeo.scale(1, 0.6, 0.8);
    const mouthInsideMesh = new THREE.Mesh(mouthInsideGeo, mouthInsideMaterial);
    mouthInsideMesh.position.set(0, -0.06, 0.08);
    jawGroup.add(mouthInsideMesh);

    const tongueGeo = new THREE.SphereGeometry(0.11, 16, 16);
    tongueGeo.scale(1.2, 0.45, 1);
    const tongueMesh = new THREE.Mesh(tongueGeo, tongueMaterial);
    tongueMesh.position.set(0, -0.1, 0.14);
    jawGroup.add(tongueMesh);

    // eyes made bigger + set slightly lower/closer together for a "baby animal" look
    const eyeRadius = 0.195;
    const createEye = (isRight: boolean) => {
      const eyePivot = new THREE.Group();
      const xSign = isRight ? 1 : -1;
      eyePivot.position.set(xSign * 0.31, 0.16, 0.58);

      const eyeGeo = new THREE.SphereGeometry(eyeRadius, 24, 24);
      const eyeMesh = new THREE.Mesh(eyeGeo, eyeWhiteMaterial);
      eyePivot.add(eyeMesh);

      const pupilGeo = new THREE.SphereGeometry(eyeRadius * 0.56, 20, 20);
      pupilGeo.scale(1, 1, 0.4);
      const pupilMesh = new THREE.Mesh(pupilGeo, eyePupilMaterial);
      pupilMesh.position.set(xSign * 0.02, 0, eyeRadius * 0.72);
      eyePivot.add(pupilMesh);

      const hl1Geo = new THREE.SphereGeometry(eyeRadius * 0.26, 14, 14);
      const hl1Mesh = new THREE.Mesh(hl1Geo, eyeHighlightMaterial);
      hl1Mesh.position.set(xSign * 0.03 + 0.038, 0.06, eyeRadius * 0.95);
      eyePivot.add(hl1Mesh);

      const hl2Geo = new THREE.SphereGeometry(eyeRadius * 0.13, 12, 12);
      const hl2Mesh = new THREE.Mesh(hl2Geo, eyeHighlightMaterial);
      hl2Mesh.position.set(xSign * 0.03 - 0.048, -0.048, eyeRadius * 0.95);
      eyePivot.add(hl2Mesh);

      const lidGeo = new THREE.SphereGeometry(eyeRadius * 1.06, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
      const lidMesh = new THREE.Mesh(lidGeo, skinMaterial);
      lidMesh.rotation.x = -Math.PI * 0.5;
      eyePivot.add(lidMesh);

      return { eyePivot, lidMesh, pupilMesh };
    };

    const leftEye = createEye(false);
    const rightEye = createEye(true);
    headGroup.add(leftEye.eyePivot);
    headGroup.add(rightEye.eyePivot);

    const cheekGeo = new THREE.SphereGeometry(0.15, 16, 16);
    cheekGeo.scale(1.25, 0.65, 0.4);
    const leftCheek = new THREE.Mesh(cheekGeo, cheekMaterial);
    leftCheek.position.set(-0.5, 0, 0.48);
    leftCheek.rotation.y = 0.35;
    headGroup.add(leftCheek);

    const rightCheek = leftCheek.clone();
    rightCheek.position.x = 0.5;
    rightCheek.rotation.y = -0.35;
    headGroup.add(rightCheek);

    const createEar = (isRight: boolean) => {
      const earPivot = new THREE.Group();
      const xSign = isRight ? 1 : -1;
      earPivot.position.set(xSign * 0.6, 0.58, 0.08);

      const outerGeo = new THREE.SphereGeometry(0.18, 20, 20);
      outerGeo.scale(0.75, 1.2, 0.5);
      const outerMesh = new THREE.Mesh(outerGeo, skinMaterial);
      outerMesh.castShadow = true;
      earPivot.add(outerMesh);

      const innerGeo = new THREE.SphereGeometry(0.13, 16, 16);
      innerGeo.scale(0.65, 1.0, 0.4);
      const innerMesh = new THREE.Mesh(innerGeo, innerEarMaterial);
      innerMesh.position.set(0, 0, 0.04);
      earPivot.add(innerMesh);

      earPivot.rotation.z = xSign * -0.4;
      return earPivot;
    };

    const leftEar = createEar(false);
    const rightEar = createEar(true);
    headGroup.add(leftEar);
    headGroup.add(rightEar);

    const createArm = (isRight: boolean) => {
      const armPivot = new THREE.Group();
      const xSign = isRight ? 1 : -1;
      armPivot.position.set(xSign * 0.72, -0.22, 0.08);

      const armGeo = new THREE.SphereGeometry(0.2, 20, 20);
      armGeo.scale(0.85, 1.5, 0.85);
      const armMesh = new THREE.Mesh(armGeo, skinMaterial);
      armMesh.position.set(0, -0.2, 0);
      armMesh.castShadow = true;
      armPivot.add(armMesh);

      armPivot.rotation.z = xSign * -0.2;
      return armPivot;
    };

    const leftArm = createArm(false);
    const rightArm = createArm(true);
    hippoGroup.add(leftArm);
    hippoGroup.add(rightArm);

    const starGeo = new THREE.OctahedronGeometry(0.12, 0);
    const starMesh = new THREE.Mesh(starGeo, starMaterial);
    starMesh.position.set(0.45, 0.75, 0.2);
    headGroup.add(starMesh);

    const particleCount = 28;
    const particleGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 2.8;
      posArray[i + 1] = Math.random() * 2 + 0.2;
      posArray[i + 2] = (Math.random() - 0.5) * 2;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.08,
      color: 0xfcd34d,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // click/poke celebration burst — a handful of gold+pink sparks that fly out and fall
    const burstCount = 26;
    const burstColors = [0xfcd34d, 0xf9a8d4, 0xa78bfa, 0x5eead4];
    const burstGeo = new THREE.BufferGeometry();
    const burstPositions = new Float32Array(burstCount * 3);
    burstGeo.setAttribute("position", new THREE.BufferAttribute(burstPositions, 3));
    const burstMat = new THREE.PointsMaterial({
      size: 0.1,
      color: 0xfcd34d,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    const burstSystem = new THREE.Points(burstGeo, burstMat);
    hippoGroup.add(burstSystem);

    let burstActive = false;
    let burstTime = 0;
    const burstVel: { x: number; y: number; z: number }[] = [];

    const triggerBurst = () => {
      burstActive = true;
      burstTime = 0;
      burstMat.color.setHex(burstColors[Math.floor(Math.random() * burstColors.length)]);
      const posAttr = burstGeo.attributes.position as THREE.BufferAttribute;
      burstVel.length = 0;
      for (let i = 0; i < burstCount; i++) {
        posAttr.setXYZ(i, 0, 0.55, 0.35);
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.7 + Math.random() * 1.0;
        burstVel.push({
          x: Math.cos(angle) * speed,
          y: Math.random() * 1.3 + 0.5,
          z: Math.sin(angle) * speed * 0.6,
        });
      }
      posAttr.needsUpdate = true;
    };
    triggerBurstFnRef.current = triggerBurst;

    // --- interactivity: cursor tracking + hover + click -------------------------------
    const mouseTarget = { x: 0, y: 0 };
    const isHovering = { current: false };
    const isPoking = { current: false };
    let pokeTime = 0;

    const handlePointerMove = (e: PointerEvent) => {
      if (!interactiveRef.current) return;
      mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseTarget.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const handlePointerEnter = () => {
      if (!interactiveRef.current) return;
      isHovering.current = true;
    };
    const handlePointerLeave = () => {
      isHovering.current = false;
    };
    const handlePointerDown = () => {
      if (!interactiveRef.current) return;
      isPoking.current = true;
      pokeTime = 0;
      triggerBurst();
      onPokeRef.current?.();
    };

    window.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerenter", handlePointerEnter);
    container.addEventListener("pointerleave", handlePointerLeave);
    container.addEventListener("pointerdown", handlePointerDown);

    let clock = new THREE.Clock();
    let blinkTimer = 0;
    let isBlinking = false;
    let blinkProgress = 0;
    let earWiggleTimer = 0;

    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();
      const currentState = stateRef.current;
      const currentVol = volumeRef.current;

      blinkTimer += delta;
      if (blinkTimer > 3.2 + Math.random() * 2) {
        isBlinking = true;
        blinkTimer = 0;
      }
      if (isBlinking) {
        blinkProgress += delta * 14;
        const lidAngle = Math.sin(Math.min(blinkProgress, Math.PI)) * (Math.PI * 0.5);
        leftEye.lidMesh.rotation.x = -Math.PI * 0.5 + lidAngle;
        rightEye.lidMesh.rotation.x = -Math.PI * 0.5 + lidAngle;
        if (blinkProgress >= Math.PI) {
          isBlinking = false;
          blinkProgress = 0;
        }
      }

      // eyes follow the cursor across the whole page; snap back to center softly when not interactive
      const trackX = interactiveRef.current ? mouseTarget.x : 0;
      const trackY = interactiveRef.current ? mouseTarget.y : 0;
      const targetEyeYaw = THREE.MathUtils.clamp(trackX, -1, 1) * 0.34;
      const targetEyePitch = THREE.MathUtils.clamp(-trackY, -1, 1) * 0.2;
      leftEye.eyePivot.rotation.y = THREE.MathUtils.lerp(leftEye.eyePivot.rotation.y, targetEyeYaw, 0.12);
      rightEye.eyePivot.rotation.y = THREE.MathUtils.lerp(rightEye.eyePivot.rotation.y, targetEyeYaw, 0.12);
      leftEye.eyePivot.rotation.x = THREE.MathUtils.lerp(leftEye.eyePivot.rotation.x, targetEyePitch, 0.12);
      rightEye.eyePivot.rotation.x = THREE.MathUtils.lerp(rightEye.eyePivot.rotation.x, targetEyePitch, 0.12);

      const hoverScale = isHovering.current ? 1.08 : 1.0;
      const lerpedScale = THREE.MathUtils.lerp(leftEye.eyePivot.scale.x, hoverScale, 0.15);
      leftEye.eyePivot.scale.setScalar(lerpedScale);
      rightEye.eyePivot.scale.setScalar(lerpedScale);

      earWiggleTimer += delta;
      let earWiggleZ = 0;
      if (earWiggleTimer > 3.5) {
        earWiggleZ = Math.sin((earWiggleTimer - 3.5) * 22) * 0.18;
        if (earWiggleTimer > 4.1) earWiggleTimer = 0;
      }
      const earPerk = isHovering.current ? 0.16 : 0;
      leftEar.rotation.z = -0.4 + earWiggleZ - earPerk;
      rightEar.rotation.z = 0.4 - earWiggleZ + earPerk;

      // brows raised on hover for a curious "oh, hi!" look
      const targetBrowY = isHovering.current ? 0.44 : 0.4;
      leftBrow.position.y = THREE.MathUtils.lerp(leftBrow.position.y, targetBrowY, 0.15);
      rightBrow.position.y = THREE.MathUtils.lerp(rightBrow.position.y, targetBrowY, 0.15);

      starMesh.rotation.y += delta * 2;
      starMesh.position.y = 0.75 + Math.sin(time * 3) * 0.04;

      const breathe = Math.sin(time * 2.2) * 0.02;
      bodyMesh.scale.set(1 + breathe, 1.02 + breathe, 0.95 - breathe);

      let targetHeadRotX = 0;
      let targetHeadRotY = Math.sin(time * 0.8) * 0.08;
      let targetHeadRotZ = 0;
      let targetJawScaleY = 0.1;
      let targetTongueY = -0.1;
      let targetLeftArmZ = 0.2;
      let targetRightArmZ = -0.2;
      let targetLeftArmX = 0;
      let targetRightArmX = 0;
      let targetHippoY = Math.sin(time * 1.5) * 0.04;
      let targetBrowLZ = 0;
      let targetBrowRZ = 0;
      let targetCheekOpacity = 0.55 + Math.sin(time * 2.5) * 0.06;

      switch (currentState) {
        case "idle":
          targetHeadRotX = Math.sin(time * 0.6) * 0.04;
          particleMat.opacity = THREE.MathUtils.lerp(particleMat.opacity, 0, 0.05);
          break;
        case "listening":
          targetHeadRotX = 0.18;
          targetHeadRotZ = 0.08;
          targetHeadRotY = Math.sin(time * 1.2) * 0.04;
          targetLeftArmZ = 0.35;
          targetRightArmZ = -0.35;
          targetBrowLZ = -0.1;
          targetBrowRZ = 0.1;
          particleMat.opacity = THREE.MathUtils.lerp(particleMat.opacity, 0.2, 0.05);
          break;
        case "thinking":
          targetHeadRotX = -0.25;
          targetHeadRotY = 0.12;
          targetRightArmZ = -1.4;
          targetRightArmX = 0.6;
          targetBrowLZ = 0.35;
          targetBrowRZ = -0.15;
          particleMat.opacity = THREE.MathUtils.lerp(particleMat.opacity, 0.7, 0.05);
          break;
        case "speaking":
          const mouthWave = currentVol > 0.05 ? currentVol * 1.8 : (Math.sin(time * 14) * 0.5 + 0.5) * 0.75;
          targetJawScaleY = 0.2 + mouthWave * 1.2;
          targetTongueY = -0.08 + mouthWave * 0.12;
          targetHeadRotX = Math.sin(time * 6) * 0.06;
          targetHeadRotY = Math.sin(time * 3) * 0.08;
          targetLeftArmZ = 0.3 + Math.sin(time * 5) * 0.1;
          targetRightArmZ = -0.3 - Math.sin(time * 5) * 0.1;
          particleMat.opacity = THREE.MathUtils.lerp(particleMat.opacity, 0.3, 0.05);
          break;
        case "positive":
          targetHippoY = 0.15 + Math.abs(Math.sin(time * 8)) * 0.18;
          targetHeadRotX = -0.1;
          targetLeftArmZ = 0.9;
          targetRightArmZ = -0.9;
          targetBrowLZ = -0.2;
          targetBrowRZ = 0.2;
          targetCheekOpacity += 0.2;
          particleMat.opacity = THREE.MathUtils.lerp(particleMat.opacity, 1.0, 0.1);
          break;
        case "encouraging":
          targetHeadRotZ = -0.15;
          targetHeadRotX = 0.08;
          targetLeftArmZ = 0.4;
          targetRightArmZ = -0.4;
          targetBrowLZ = -0.15;
          targetBrowRZ = 0.15;
          particleMat.opacity = THREE.MathUtils.lerp(particleMat.opacity, 0.4, 0.05);
          break;
      }

      // a light mouse-following head tilt layered on top of the state animation, so the
      // hippo reads as "watching" the user rather than only its eyes moving
      if (interactiveRef.current) {
        targetHeadRotY += trackX * 0.06;
        targetHeadRotX += -trackY * 0.04;
      }

      headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, targetHeadRotX, 0.1);
      headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, targetHeadRotY, 0.1);
      headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, targetHeadRotZ, 0.1);

      jawGroup.scale.y = THREE.MathUtils.lerp(jawGroup.scale.y, targetJawScaleY, 0.2);
      tongueMesh.position.y = THREE.MathUtils.lerp(tongueMesh.position.y, targetTongueY, 0.2);
      smileMesh.visible = jawGroup.scale.y < 0.5;

      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, targetLeftArmZ, 0.1);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, targetRightArmZ, 0.1);
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, targetRightArmX, 0.1);
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, targetLeftArmX, 0.1);

      leftBrow.rotation.z = THREE.MathUtils.lerp(leftBrow.rotation.z, targetBrowLZ, 0.12);
      rightBrow.rotation.z = THREE.MathUtils.lerp(rightBrow.rotation.z, targetBrowRZ, 0.12);

      cheekMaterial.opacity = THREE.MathUtils.lerp(cheekMaterial.opacity, Math.min(targetCheekOpacity, 0.95), 0.08);

      hippoGroup.position.y = THREE.MathUtils.lerp(hippoGroup.position.y, targetHippoY, 0.1);

      // poke squish — a quick springy squash-and-stretch, decaying back to normal
      if (isPoking.current) {
        pokeTime += delta;
        const decay = Math.exp(-pokeTime * 6);
        const squish = Math.sin(pokeTime * 18) * decay * 0.16;
        hippoGroup.scale.set(1 - squish * 0.6, 1 + squish, 1 - squish * 0.6);
        if (pokeTime > 0.7) {
          isPoking.current = false;
          hippoGroup.scale.set(1, 1, 1);
        }
      }

      // celebration burst physics
      if (burstActive) {
        burstTime += delta;
        const posAttr = burstGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < burstCount; i++) {
          const v = burstVel[i];
          posAttr.setXYZ(
            i,
            posAttr.getX(i) + v.x * delta,
            posAttr.getY(i) + (v.y - burstTime * 2.0) * delta,
            posAttr.getZ(i) + v.z * delta
          );
        }
        posAttr.needsUpdate = true;
        burstMat.opacity = burstTime > 0.9 ? THREE.MathUtils.lerp(burstMat.opacity, 0, 0.15) : THREE.MathUtils.lerp(burstMat.opacity, 1, 0.4);
        if (burstTime > 1.4) {
          burstActive = false;
          burstMat.opacity = 0;
        }
      }

      particleSystem.rotation.y += delta * 0.4;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    const animId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerenter", handlePointerEnter);
      container.removeEventListener("pointerleave", handlePointerLeave);
      container.removeEventListener("pointerdown", handlePointerDown);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <div ref={mountRef} className="h-full w-full max-h-[350px] max-w-[350px]" />
    </div>
  );
}
