// LatheSimulator3D.js
export class LatheSimulator3D {
    constructor() {
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
        
        this.materialRemoved = 0; 
        this.isRunning = false;
        
        this.init();
    }
    
    init() {
        const container = document.getElementById('threejs-container');
        if (!container) return;
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a2634);
        
        this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.camera.position.set(4, 3, 6);
        this.camera.lookAt(0, 0.8, 0.5);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.innerHTML = '';
        container.appendChild(this.renderer.domElement);
        
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
        this.setupControls();
        
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    buildLathe() {
        const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.4, metalness: 0.6 });
        const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.3, metalness: 0.3 });
        const toolMaterial = new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.2, metalness: 0.8 });
        
        // Станина
        const bedGroup = new THREE.Group();
        const bedBeam = new THREE.BoxGeometry(6.5, 0.3, 1.2);
        const bedMesh = new THREE.Mesh(bedBeam, metalMaterial);
        bedMesh.position.set(-0.2, 0.15, 0);
        bedMesh.castShadow = true;
        bedMesh.receiveShadow = true;
        bedGroup.add(bedMesh);
        
        const wayGeo = new THREE.BoxGeometry(6.5, 0.15, 0.25);
        const way1 = new THREE.Mesh(wayGeo, accentMaterial);
        way1.position.set(-0.2, 0.4, -0.4);
        way1.castShadow = true;
        way1.receiveShadow = true;
        bedGroup.add(way1);
        
        const way2 = new THREE.Mesh(wayGeo, accentMaterial);
        way2.position.set(-0.2, 0.4, 0.4);
        way2.castShadow = true;
        way2.receiveShadow = true;
        bedGroup.add(way2);
        
        bedGroup.position.set(0, 0, 0);
        this.scene.add(bedGroup);
        this.bed = bedGroup;
        
        // Передняя бабка
        const headstockGroup = new THREE.Group();
        const headstockBase = new THREE.BoxGeometry(1.4, 1.0, 1.2);
        const headstockMesh = new THREE.Mesh(headstockBase, accentMaterial);
        headstockMesh.position.set(-2.4, 0.7, 0);
        headstockMesh.castShadow = true;
        headstockMesh.receiveShadow = true;
        headstockGroup.add(headstockMesh);
        
        const spindleHousing = new THREE.CylinderGeometry(0.6, 0.6, 0.7, 12);
        const spindleMesh = new THREE.Mesh(spindleHousing, metalMaterial);
        spindleMesh.position.set(-1.7, 0.8, 0);
        spindleMesh.rotation.z = Math.PI / 2;
        spindleMesh.castShadow = true;
        spindleMesh.receiveShadow = true;
        headstockGroup.add(spindleMesh);
        
        this.scene.add(headstockGroup);
        this.headstock = headstockGroup;
        
        // Патрон (уменьшенный)
        const chuckGroup = new THREE.Group();
        const chuckBody = new THREE.CylinderGeometry(0.3, 0.3, 0.6, 8);
        const chuckMesh = new THREE.Mesh(chuckBody, new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.3, metalness: 0.7 }));
        chuckMesh.position.set(0, 0, 0);
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
        
        // Задняя бабка
        const tailstockGroup = new THREE.Group();
        const tailstockBase = new THREE.BoxGeometry(1.0, 0.9, 1.2);
        const tailstockMesh = new THREE.Mesh(tailstockBase, accentMaterial);
        tailstockMesh.position.set(2.2, 0.65, 0);
        tailstockMesh.castShadow = true;
        tailstockMesh.receiveShadow = true;
        tailstockGroup.add(tailstockMesh);
        
        const tailstockBody = new THREE.BoxGeometry(0.6, 0.7, 1.0);
        const bodyMesh = new THREE.Mesh(tailstockBody, metalMaterial);
        bodyMesh.position.set(2.5, 0.9, 0);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        tailstockGroup.add(bodyMesh);
        
        const quillGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8);
        const quill = new THREE.Mesh(quillGeo, metalMaterial);
        quill.position.set(2.0, 0.9, 0);
        quill.rotation.z = Math.PI / 2;
        quill.castShadow = true;
        quill.receiveShadow = true;
        tailstockGroup.add(quill);
        
        const centerGeo = new THREE.ConeGeometry(0.2, 0.4, 8);
        const center = new THREE.Mesh(centerGeo, new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.2, metalness: 0.9 }));
        center.position.set(1.7, 0.9, 0);
        center.rotation.z = Math.PI / 2;
        center.castShadow = true;
        center.receiveShadow = true;
        tailstockGroup.add(center);
        
        const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 8);
        const wheel = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x2c3e50 }));
        wheel.position.set(2.8, 0.9, 0.5);
        wheel.rotation.x = Math.PI / 2;
        wheel.castShadow = true;
        wheel.receiveShadow = true;
        tailstockGroup.add(wheel);
        
        this.scene.add(tailstockGroup);
        this.tailstock = tailstockGroup;
        
        // Заготовка (40 сегментов)
        const totalLength = 2.6;
        const startX = -1.0;
        const endX = 1.6;
        const numSegments = 40;
        const segmentLength = totalLength / numSegments;
        const radius = 0.2;
        const baseColor = 0x3498db;
        const processedColor = 0xbdc3c7;
        
        const segmentGeo = new THREE.CylinderGeometry(radius, radius, segmentLength, 12);
        
        for (let i = 0; i < numSegments; i++) {
            const centerX = startX + segmentLength * (i + 0.5);
            
            const material = new THREE.MeshStandardMaterial({
                color: baseColor,
                roughness: 0.3,
                metalness: 0.2
            });
            
            const segment = new THREE.Mesh(segmentGeo, material);
            segment.position.set(centerX, 0.85, 0);
            segment.rotation.z = Math.PI / 2;
            segment.castShadow = true;
            segment.receiveShadow = true;
            
            segment.userData = {
                left: centerX - segmentLength/2,
                right: centerX + segmentLength/2,
                baseColor: baseColor,
                processedColor: processedColor,
                material: material,
                processed: false
            };
            
            this.scene.add(segment);
            this.workpieceSegments.push(segment);
        }
        
        // Торцевые заглушки
        const capMaterial = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.5 });
        const capGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.15, 12);
        
        const cap1 = new THREE.Mesh(capGeo, capMaterial);
        cap1.position.set(-1.0, 0.85, 0);
        cap1.rotation.z = Math.PI / 2;
        cap1.castShadow = true;
        cap1.receiveShadow = true;
        this.scene.add(cap1);
        
        const cap2 = new THREE.Mesh(capGeo, capMaterial);
        cap2.position.set(1.6, 0.85, 0);
        cap2.rotation.z = Math.PI / 2;
        cap2.castShadow = true;
        cap2.receiveShadow = true;
        this.scene.add(cap2);
        
        // Суппорт с резцом
        this.toolGroup = new THREE.Group();
        
        const toolPostBase = new THREE.BoxGeometry(0.8, 0.5, 1.0);
        const toolPostMesh = new THREE.Mesh(toolPostBase, new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.5 }));
        toolPostMesh.position.set(0, 0.5, 0.8);
        toolPostMesh.castShadow = true;
        toolPostMesh.receiveShadow = true;
        this.toolGroup.add(toolPostMesh);
        
        const carriageGeo = new THREE.BoxGeometry(0.6, 0.3, 0.7);
        const carriageMesh = new THREE.Mesh(carriageGeo, new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.3 }));
        carriageMesh.position.set(0.2, 0.9, 0.7);
        carriageMesh.castShadow = true;
        carriageMesh.receiveShadow = true;
        this.toolGroup.add(carriageMesh);
        
        const holderGeo = new THREE.BoxGeometry(0.3, 0.2, 0.4);
        const holderMesh = new THREE.Mesh(holderGeo, new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.4 }));
        holderMesh.position.set(0.6, 0.9, 0.5);
        holderMesh.castShadow = true;
        holderMesh.receiveShadow = true;
        this.toolGroup.add(holderMesh);
        
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
        const chipMaterial = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.2, metalness: 0.8 });
        for (let i = 0; i < 30; i++) {
            const chipGeo = new THREE.BoxGeometry(0.05 + Math.random() * 0.1, 0.01, 0.05 + Math.random() * 0.1);
            const chip = new THREE.Mesh(chipGeo, chipMaterial);
            chip.visible = false;
            chip.castShadow = true;
            chip.receiveShadow = true;
            this.scene.add(chip);
            this.chips.push(chip);
        }
    }
    
    setupControls() {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        
        this.renderer.domElement.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                isDragging = true;
                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });
        
        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;
                
                const target = new THREE.Vector3(0, 0.8, 0.5);
                const radius = this.camera.position.distanceTo(target);
                
                const currentPos = this.camera.position.clone().sub(target);
                let theta = Math.atan2(currentPos.z, currentPos.x);
                let phi = Math.atan2(currentPos.y, Math.sqrt(currentPos.x * currentPos.x + currentPos.z * currentPos.z));
                
                theta += deltaX * 0.01;
                phi += deltaY * 0.01;
                
                phi = Math.max(0.3, Math.min(Math.PI - 0.3, phi));
                
                const newX = radius * Math.cos(theta) * Math.cos(phi);
                const newY = radius * Math.sin(phi);
                const newZ = radius * Math.sin(theta) * Math.cos(phi);
                
                this.camera.position.copy(target.clone().add(new THREE.Vector3(newX, newY, newZ)));
                this.camera.lookAt(target);
                
                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });
        
        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
        
        this.renderer.domElement.addEventListener('wheel', (e) => {
            const delta = e.deltaY > 0 ? 1.1 : 0.9;
            const target = new THREE.Vector3(0, 0.8, 0.5);
            const direction = this.camera.position.clone().sub(target).normalize();
            const distance = this.camera.position.distanceTo(target);
            const newDistance = distance * delta;
            
            if (newDistance > 1.5 && newDistance < 10) {
                this.camera.position.copy(target.clone().add(direction.multiplyScalar(newDistance)));
            }
        });
    }
    
    onWindowResize() {
        const container = document.getElementById('threejs-container');
        if (container && this.camera && this.renderer) {
            this.camera.aspect = container.clientWidth / container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.clientWidth, container.clientHeight);
        }
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
        if (this.toolGroup) {
            this.toolGroup.position.x = 0.75;
        }
        this.workpieceSegments.forEach(segment => {
            segment.material.color.setHex(segment.userData.baseColor);
            segment.userData.processed = false;
        });
        this.materialRemoved = 0;
        
        this.chips.forEach(chip => {
            chip.visible = false;
        });
    }
    
    animate() {
        if (!this.isRunning) return;
        
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const speedControl = document.getElementById('speedControl');
        if (speedControl) {
            this.rotationSpeed = 0.02 * parseFloat(speedControl.value);
        }
        
        const feedControl = document.getElementById('feedControl');
        if (feedControl) {
            this.feedRate = 0.002 * parseFloat(feedControl.value);
        }
        
        // Вращение заготовки и патрона
        if (this.workpieceSegments.length > 0) {
            this.workpieceSegments.forEach(segment => {
                segment.rotation.x += this.rotationSpeed;
            });
        }
        if (this.chuck) {
            this.chuck.rotation.x += this.rotationSpeed;
        }
        
        if (this.toolGroup) {
            if (this.toolPosition < this.maxToolTravel) {
                this.toolPosition += this.feedRate;
                
                const startX = 0.75;
                const endX = -1.65;
                const newX = startX - (this.toolPosition / this.maxToolTravel) * (startX - endX);
                this.toolGroup.position.x = newX;
                
                const toolGlobalX = newX + 0.95;
                
                this.workpieceSegments.forEach(segment => {
                    if (!segment.userData.processed && toolGlobalX < segment.userData.right) {
                        segment.userData.processed = true;
                        segment.material.color.setHex(segment.userData.processedColor);
                    }
                });
                
                if (Math.random() < 0.15 && this.toolPosition > 0.1) {
                    const chip = this.chips.find(c => !c.visible);
                    if (chip) {
                        chip.position.set(
                            this.toolGroup.position.x + 0.5,
                            0.85 + Math.random() * 0.3,
                            0.2 + Math.random() * 0.2
                        );
                        chip.rotation.set(Math.random(), Math.random(), Math.random());
                        chip.visible = true;
                        
                        setTimeout(() => {
                            if (chip) chip.visible = false;
                        }, 400);
                    }
                }
            } else {
                this.toolPosition = 0;
            }
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}