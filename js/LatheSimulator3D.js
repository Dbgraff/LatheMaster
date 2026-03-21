// LatheSimulator3D.js
export class LatheSimulator3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.animationId = null;

        this.workpieceSegments = [];
        this.chuck = null;
        this.tool = null;
        this.toolGroup = null;
        this.chips = [];

        this.rotationSpeed = 0.02;
        this.feedRate = 0.002;
        this.toolPosition = 0;
        this.maxToolTravel = 2.4;

        this.isRunning = false;

        this.init();
    }

    init() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a2634);

        this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        this.camera.position.set(4, 3, 6);
        this.camera.lookAt(0, 0.8, 0.5);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        // Освещение
        const ambientLight = new THREE.AmbientLight(0x404060);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(3, 8, 5);
        dirLight.castShadow = true;
        dirLight.receiveShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        const d = 8;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        dirLight.shadow.camera.near = 1;
        dirLight.shadow.camera.far = 15;
        this.scene.add(dirLight);

        const fillLight = new THREE.PointLight(0x446688, 0.5);
        fillLight.position.set(-2, 4, 3);
        this.scene.add(fillLight);

        const gridHelper = new THREE.GridHelper(8, 16, 0x88aadd, 0x335577);
        gridHelper.position.y = 0;
        this.scene.add(gridHelper);

        this.buildLathe();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    buildLathe() {
        const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.4, metalness: 0.6 });
        const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.3, metalness: 0.3 });
        const toolMaterial = new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.2, metalness: 0.8 });

        // Станина (упрощённо)
        const bedGeo = new THREE.BoxGeometry(6.5, 0.3, 1.2);
        const bed = new THREE.Mesh(bedGeo, metalMaterial);
        bed.position.set(-0.2, 0.15, 0);
        bed.castShadow = true;
        bed.receiveShadow = true;
        this.scene.add(bed);

        // Направляющие
        const wayGeo = new THREE.BoxGeometry(6.5, 0.15, 0.25);
        const way1 = new THREE.Mesh(wayGeo, accentMaterial);
        way1.position.set(-0.2, 0.4, -0.4);
        way1.castShadow = true;
        way1.receiveShadow = true;
        this.scene.add(way1);

        const way2 = new THREE.Mesh(wayGeo, accentMaterial);
        way2.position.set(-0.2, 0.4, 0.4);
        way2.castShadow = true;
        way2.receiveShadow = true;
        this.scene.add(way2);

        // Передняя бабка (упрощённо)
        const headstockGeo = new THREE.BoxGeometry(1.4, 1.0, 1.2);
        const headstock = new THREE.Mesh(headstockGeo, accentMaterial);
        headstock.position.set(-2.4, 0.7, 0);
        headstock.castShadow = true;
        headstock.receiveShadow = true;
        this.scene.add(headstock);

        // Патрон
        const chuckGroup = new THREE.Group();
        const chuckBody = new THREE.CylinderGeometry(0.3, 0.3, 0.6, 8);
        const chuckMesh = new THREE.Mesh(chuckBody, new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.3, metalness: 0.7 }));
        chuckMesh.rotation.z = Math.PI / 2;
        chuckMesh.castShadow = true;
        chuckMesh.receiveShadow = true;
        chuckGroup.add(chuckMesh);

        for (let i = 0; i < 3; i++) {
            const jawGeo = new THREE.BoxGeometry(0.15, 0.25, 0.25);
            const jaw = new THREE.Mesh(jawGeo, new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.2, metalness: 0.8 }));
            const angle = (i / 3) * Math.PI * 2;
            jaw.position.set(0, Math.sin(angle) * 0.3, Math.cos(angle) * 0.3);
            jaw.castShadow = true;
            jaw.receiveShadow = true;
            chuckGroup.add(jaw);
        }
        chuckGroup.position.set(-1.2, 0.85, 0);
        this.scene.add(chuckGroup);
        this.chuck = chuckGroup;

        // Задняя бабка (упрощённо)
        const tailstockGeo = new THREE.BoxGeometry(1.0, 0.9, 1.2);
        const tailstock = new THREE.Mesh(tailstockGeo, accentMaterial);
        tailstock.position.set(2.2, 0.65, 0);
        tailstock.castShadow = true;
        tailstock.receiveShadow = true;
        this.scene.add(tailstock);

        const quillGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8);
        const quill = new THREE.Mesh(quillGeo, metalMaterial);
        quill.position.set(2.0, 0.9, 0);
        quill.rotation.z = Math.PI / 2;
        quill.castShadow = true;
        quill.receiveShadow = true;
        this.scene.add(quill);

        const centerGeo = new THREE.ConeGeometry(0.2, 0.4, 8);
        const center = new THREE.Mesh(centerGeo, new THREE.MeshStandardMaterial({ color: 0xe67e22 }));
        center.position.set(1.7, 0.9, 0);
        center.rotation.z = Math.PI / 2;
        center.castShadow = true;
        center.receiveShadow = true;
        this.scene.add(center);

        // Заготовка из сегментов
        const totalLength = 2.6;
        const startX = -1.0;
        const numSegments = 40;
        const segmentLength = totalLength / numSegments;
        const radius = 0.2;
        const baseColor = 0x3498db;
        const processedColor = 0xbdc3c7;
        const segmentGeo = new THREE.CylinderGeometry(radius, radius, segmentLength, 12);

        for (let i = 0; i < numSegments; i++) {
            const centerX = startX + segmentLength * (i + 0.5);
            const material = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.3, metalness: 0.2 });
            const segment = new THREE.Mesh(segmentGeo, material);
            segment.position.set(centerX, 0.85, 0);
            segment.rotation.z = Math.PI / 2;
            segment.castShadow = true;
            segment.receiveShadow = true;
            segment.userData = {
                left: centerX - segmentLength/2,
                right: centerX + segmentLength/2,
                baseColor,
                processedColor,
                processed: false
            };
            this.scene.add(segment);
            this.workpieceSegments.push(segment);
        }

        // Суппорт с резцом
        this.toolGroup = new THREE.Group();

        const postGeo = new THREE.BoxGeometry(0.8, 0.5, 1.0);
        const post = new THREE.Mesh(postGeo, new THREE.MeshStandardMaterial({ color: 0x27ae60 }));
        post.position.set(0, 0.5, 0.8);
        post.castShadow = true;
        post.receiveShadow = true;
        this.toolGroup.add(post);

        const carriageGeo = new THREE.BoxGeometry(0.6, 0.3, 0.7);
        const carriage = new THREE.Mesh(carriageGeo, new THREE.MeshStandardMaterial({ color: 0xf1c40f }));
        carriage.position.set(0.2, 0.9, 0.7);
        carriage.castShadow = true;
        carriage.receiveShadow = true;
        this.toolGroup.add(carriage);

        const holderGeo = new THREE.BoxGeometry(0.3, 0.2, 0.4);
        const holder = new THREE.Mesh(holderGeo, new THREE.MeshStandardMaterial({ color: 0x95a5a6 }));
        holder.position.set(0.6, 0.9, 0.5);
        holder.castShadow = true;
        holder.receiveShadow = true;
        this.toolGroup.add(holder);

        const cutterGeo = new THREE.ConeGeometry(0.1, 0.4, 6);
        this.tool = new THREE.Mesh(cutterGeo, toolMaterial);
        this.tool.position.set(0.8, 0.85, 0.25);
        this.tool.rotation.x = Math.PI / 2;
        this.tool.castShadow = true;
        this.tool.receiveShadow = true;
        this.toolGroup.add(this.tool);

        this.toolGroup.position.set(0.75, 0, 0);
        this.scene.add(this.toolGroup);

        // Стружка
        const chipMaterial = new THREE.MeshStandardMaterial({ color: 0xc0c0c0 });
        for (let i = 0; i < 20; i++) {
            const chipGeo = new THREE.BoxGeometry(0.05 + Math.random()*0.1, 0.01, 0.05 + Math.random()*0.1);
            const chip = new THREE.Mesh(chipGeo, chipMaterial);
            chip.visible = false;
            chip.castShadow = true;
            chip.receiveShadow = true;
            this.scene.add(chip);
            this.chips.push(chip);
        }
    }

    onWindowResize() {
        if (!this.container || !this.camera || !this.renderer) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.animate();
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    reset() {
        this.toolPosition = 0;
        if (this.toolGroup) this.toolGroup.position.x = 0.75;
        this.workpieceSegments.forEach(seg => {
            seg.material.color.setHex(seg.userData.baseColor);
            seg.userData.processed = false;
        });
        this.chips.forEach(chip => chip.visible = false);
    }

    animate() {
        if (!this.isRunning) return;
        this.animationId = requestAnimationFrame(() => this.animate());

        // Скорость и подача из слайдеров (если есть)
        const speedInput = document.getElementById('speedControl');
        if (speedInput) this.rotationSpeed = 0.02 * parseFloat(speedInput.value);
        const feedInput = document.getElementById('feedControl');
        if (feedInput) this.feedRate = 0.002 * parseFloat(feedInput.value);

        // Вращение патрона и сегментов
        if (this.chuck) this.chuck.rotation.x += this.rotationSpeed;
        this.workpieceSegments.forEach(seg => seg.rotation.x += this.rotationSpeed);

        if (this.toolGroup) {
            if (this.toolPosition < this.maxToolTravel) {
                this.toolPosition += this.feedRate;
                const startX = 0.75;
                const endX = -1.65;
                const newX = startX - (this.toolPosition / this.maxToolTravel) * (startX - endX);
                this.toolGroup.position.x = newX;

                const toolGlobalX = newX + 0.95;

                // Обновление цвета сегментов
                this.workpieceSegments.forEach(seg => {
                    if (!seg.userData.processed && toolGlobalX < seg.userData.right) {
                        seg.userData.processed = true;
                        seg.material.color.setHex(seg.userData.processedColor);
                    }
                });

                // Стружка
                if (Math.random() < 0.1 && this.toolPosition > 0.1) {
                    const chip = this.chips.find(c => !c.visible);
                    if (chip) {
                        chip.position.set(this.toolGroup.position.x + 0.5, 0.85 + Math.random()*0.3, 0.2 + Math.random()*0.2);
                        chip.rotation.set(Math.random(), Math.random(), Math.random());
                        chip.visible = true;
                        setTimeout(() => { chip.visible = false; }, 400);
                    }
                }
            } else {
                this.toolPosition = 0;
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}