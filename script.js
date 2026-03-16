// Проверка наличия Three.js и его загрузка при необходимости
if (typeof THREE === 'undefined') {
    console.log('Three.js will be loaded dynamically');
}

// 2.5D симулятор с Three.js (ФИНАЛЬНАЯ ВЕРСИЯ - УМЕНЬШЕННЫЙ ПАТРОН)
class LatheSimulator3D {
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
        this.setupControls();
        
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    buildLathe() {
        const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.4, metalness: 0.6 });
        const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.3, metalness: 0.3 });
        const toolMaterial = new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.2, metalness: 0.8 });
        
        // ========== СТАНИНА ==========
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
        
        // ========== ПЕРЕДНЯЯ БАБКА ==========
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
        
        // ========== ПАТРОН (УМЕНЬШЕННЫЙ) ==========
        const chuckGroup = new THREE.Group();
        
        // Корпус патрона: диаметр 0.6 (радиус 0.3), высота 0.6
        const chuckBody = new THREE.CylinderGeometry(0.3, 0.3, 0.6, 8);
        const chuckMesh = new THREE.Mesh(chuckBody, new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.3, metalness: 0.7 }));
        chuckMesh.position.set(0, 0, 0);
        chuckMesh.rotation.z = Math.PI / 2;
        chuckMesh.castShadow = true;
        chuckMesh.receiveShadow = true;
        chuckGroup.add(chuckMesh);
        
        // Кулачки на поверхности патрона (радиус 0.3)
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
        
        // ========== ЗАДНЯЯ БАБКА ==========
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
        
        // ========== ЗАГОТОВКА (40 СЕГМЕНТОВ, ДЛИНА 2.6) ==========
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
        
        // ========== СУППОРТ С РЕЗЦОМ ==========
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
        
        // ========== СТРУЖКА ==========
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

// Основной класс приложения (без изменений)
class LatheTextbook {
    constructor() {
        this.currentChapter = 1;
        this.totalChapters = 12;
        this.completedChapters = 1;
        
        this.testState = {
            current: 1,
            total: 5,
            answers: {},
            correct: {
                1: '2',
                2: '2',
                3: '3',
                4: '1',
                5: '2'
            }
        };
        
        this.partsData = {
            headstock: {
                title: 'Передняя бабка',
                description: 'Передняя бабка - корпусной узел, в котором размещены шпиндель и коробка скоростей. Обеспечивает вращение заготовки с различными частотами.',
                elements: [
                    'Шпиндель - полый вал на подшипниках',
                    'Коробка скоростей - набор зубчатых колес',
                    'Подшипники (передний роликовый, задний шариковый)',
                    'Механизм реверса',
                    'Тормозное устройство'
                ],
                specs: 'Отверстие шпинделя 52 мм, конус Морзе №6, диапазон 12.5-2000 об/мин, 22 ступени'
            },
            chuck: {
                title: 'Патрон',
                description: 'Трехкулачковый самоцентрирующийся патрон для закрепления цилиндрических заготовок. Обеспечивает надежный зажим и точное центрирование.',
                elements: [
                    'Корпус из высокопрочного чугуна',
                    'Кулачки (прямые и обратные)',
                    'Спиральный механизм центрирования',
                    'Зажимной ключ',
                    'Регулировочные винты'
                ],
                specs: 'Диаметр 200 мм, диапазон зажима 5-180 мм, точность центрирования 0.05 мм'
            },
            tailstock: {
                title: 'Задняя бабка',
                description: 'Задняя бабка служит для поддержки длинных заготовок при обработке в центрах, а также для установки сверл, зенкеров и другого инструмента.',
                elements: [
                    'Основание - перемещается по направляющим',
                    'Корпус с возможностью поперечного смещения',
                    'Пиноль - выдвижная гильза с конусом Морзе',
                    'Маховик с лимбом для точного перемещения',
                    'Фиксатор положения'
                ],
                specs: 'Ход пиноли 120 мм, конус Морзе №4, поперечное смещение ±15 мм, усилие зажима до 300 кгс'
            },
            carriage: {
                title: 'Суппорт',
                description: 'Суппорт обеспечивает перемещение резца в продольном, поперечном и наклонном направлениях для обработки заготовки.',
                elements: [
                    'Каретка (продольные салазки) - перемещение вдоль станины',
                    'Поперечные салазки - движение перпендикулярно оси',
                    'Верхние поворотные салазки - под углом до ±45°',
                    'Резцедержатель для крепления инструмента',
                    'Фартук с механизмами подачи'
                ],
                specs: 'Продольное перемещение 900 мм, поперечное 250 мм, ход верхних салазок 140 мм, цена деления лимбов 0.05 мм'
            },
            toolpost: {
                title: 'Резцедержатель',
                description: 'Резцедержатель служит для закрепления резца на суппорте. Обеспечивает быструю смену и надежную фиксацию инструмента.',
                elements: [
                    'Корпус с посадочным местом',
                    'Прихваты для зажима резца',
                    'Регулировочные винты',
                    'Фиксатор положения',
                    'Поворотный механизм (для многопозиционных)'
                ],
                specs: 'Количество позиций: 1-4, сечение резца 16×16 - 40×40 мм, время смены 5-30 сек'
            }
        };
        
        this.simulator3D = null;
        this.init();
    }
    
    init() {
        this.setupNavigation();
        this.setupInteractiveElements();
        this.setupModal();
        this.setupTest();
        this.setupSimulator();
        this.updateProgress();
    }
    
    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const chapter = e.currentTarget.dataset.chapter;
                this.switchChapter(parseInt(chapter));
            });
        });
        
        document.getElementById('prevChapterBtn').addEventListener('click', () => {
            if (this.currentChapter > 1) {
                this.switchChapter(this.currentChapter - 1);
            }
        });
        
        document.getElementById('nextChapterBtn').addEventListener('click', () => {
            if (this.currentChapter < this.totalChapters) {
                this.switchChapter(this.currentChapter + 1);
            }
        });
    }
    
    switchChapter(num) {
        if (num < 1 || num > this.totalChapters) return;
        
        document.querySelectorAll('.chapter').forEach(ch => {
            ch.classList.remove('active');
        });
        
        const chapter = document.getElementById(`chapter${num}`);
        if (chapter) chapter.classList.add('active');
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`.nav-item[data-chapter="${num}"]`);
        if (activeItem) activeItem.classList.add('active');
        
        this.currentChapter = num;
        document.getElementById('currentChapterDisplay').textContent = num;
        
        document.getElementById('prevChapterBtn').disabled = num === 1;
        document.getElementById('nextChapterBtn').disabled = num === this.totalChapters;
        
        if (num > this.completedChapters) {
            this.completedChapters = num;
            this.updateProgress();
        }
        
        document.querySelector('.main-content').scrollTop = 0;
        
        if (num === 12) {
            this.init3DSimulator();
        } else {
            if (this.simulator3D) {
                this.simulator3D.stop();
            }
        }
    }
    
    updateProgress() {
        const percent = (this.completedChapters / this.totalChapters) * 100;
        
        const fill = document.getElementById('progressFill');
        const percentSpan = document.getElementById('progressPercent');
        const textSpan = document.getElementById('progressText');
        
        if (fill) fill.style.width = percent + '%';
        if (percentSpan) percentSpan.textContent = Math.round(percent) + '%';
        if (textSpan) textSpan.textContent = `${this.completedChapters} из ${this.totalChapters} глав`;
    }
    
    setupInteractiveElements() {
        document.querySelectorAll('.data-table tbody tr').forEach(row => {
            row.addEventListener('click', (e) => {
                const part = row.dataset.part;
                if (part) {
                    this.showPartModal(part);
                }
            });
        });
    }
    
    setupModal() {
        this.modal = document.getElementById('partModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalDescription = document.getElementById('modalDescription');
        this.modalList = document.getElementById('modalList');
        this.modalSpecs = document.getElementById('modalSpecs');
        
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.modal.classList.remove('show');
        });
        
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.modal.classList.remove('show');
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('show')) {
                this.modal.classList.remove('show');
            }
        });
    }
    
    showPartModal(partName) {
        const data = this.partsData[partName];
        if (!data) return;
        
        this.modalTitle.textContent = data.title;
        this.modalDescription.textContent = data.description;
        
        this.modalList.innerHTML = '';
        data.elements.forEach(el => {
            const li = document.createElement('li');
            li.textContent = el;
            this.modalList.appendChild(li);
        });
        
        this.modalSpecs.innerHTML = `<strong>Характеристики:</strong> ${data.specs}`;
        
        this.modal.classList.add('show');
    }
    
    setupTest() {
        this.testCurrent = 1;
        this.testAnswers = {};
        
        this.testProgress = document.getElementById('testProgress');
        this.testCounter = document.getElementById('testCounter');
        this.testQuestion = document.getElementById('testQuestion');
        this.testPrev = document.getElementById('testPrev');
        this.testNext = document.getElementById('testNext');
        this.testSubmit = document.getElementById('testSubmit');
        this.testResult = document.getElementById('testResult');
        this.resultScore = document.getElementById('resultScore');
        this.testRestart = document.getElementById('testRestart');
        
        this.questions = {
            1: {
                text: '1. Какой узел токарного станка служит для закрепления и вращения заготовки?',
                options: ['Задняя бабка', 'Передняя бабка со шпинделем', 'Суппорт', 'Станина']
            },
            2: {
                text: '2. Для чего предназначена задняя бабка?',
                options: ['Для вращения заготовки', 'Для поддержки длинных заготовок', 'Для перемещения резца', 'Для изменения скорости']
            },
            3: {
                text: '3. Какой элемент суппорта перемещается по направляющим станины?',
                options: ['Верхние салазки', 'Резцедержатель', 'Каретка', 'Поперечные салазки']
            },
            4: {
                text: '4. Какое движение является главным при точении?',
                options: ['Вращение заготовки', 'Продольное перемещение резца', 'Поперечное перемещение резца', 'Перемещение задней бабки']
            },
            5: {
                text: '5. Какой инструмент используется для нарезания резьбы на токарном станке?',
                options: ['Проходной резец', 'Резьбовой резец', 'Отрезной резец', 'Расточной резец']
            }
        };
        
        this.testPrev.addEventListener('click', () => this.prevQuestion());
        this.testNext.addEventListener('click', () => this.nextQuestion());
        this.testSubmit.addEventListener('click', () => this.submitTest());
        this.testRestart.addEventListener('click', () => this.restartTest());
        
        this.loadTestQuestion(1);
    }
    
    loadTestQuestion(num) {
        const question = this.questions[num];
        if (!question) return;
        
        this.testProgress.style.width = (num / this.testState.total * 100) + '%';
        this.testCounter.textContent = `${num}/${this.testState.total}`;
        
        let html = `<p class="question-text">${question.text}</p>`;
        html += '<div class="test-options">';
        
        question.options.forEach((opt, index) => {
            const value = (index + 1).toString();
            const checked = this.testAnswers[num] === value ? 'checked' : '';
            html += `
                <label class="test-option">
                    <input type="radio" name="q${num}" value="${value}" ${checked}>
                    <span>${opt}</span>
                </label>
            `;
        });
        
        html += '</div>';
        this.testQuestion.innerHTML = html;
        
        document.querySelectorAll(`.test-option input[name="q${num}"]`).forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.testAnswers[num] = e.target.value;
                this.testState.answers[num] = e.target.value;
            });
        });
        
        this.testPrev.disabled = num === 1;
        this.testNext.style.display = num === this.testState.total ? 'none' : 'block';
        this.testSubmit.style.display = num === this.testState.total ? 'block' : 'none';
    }
    
    prevQuestion() {
        if (this.testCurrent > 1) {
            this.testCurrent--;
            this.loadTestQuestion(this.testCurrent);
        }
    }
    
    nextQuestion() {
        if (this.testCurrent < this.testState.total) {
            const selected = document.querySelector(`input[name="q${this.testCurrent}"]:checked`);
            if (selected) {
                this.testAnswers[this.testCurrent] = selected.value;
                this.testState.answers[this.testCurrent] = selected.value;
            }
            
            this.testCurrent++;
            this.loadTestQuestion(this.testCurrent);
        }
    }
    
    submitTest() {
        const selected = document.querySelector(`input[name="q${this.testCurrent}"]:checked`);
        if (selected) {
            this.testAnswers[this.testCurrent] = selected.value;
            this.testState.answers[this.testCurrent] = selected.value;
        }
        
        let correct = 0;
        for (let i = 1; i <= this.testState.total; i++) {
            if (this.testAnswers[i] === this.testState.correct[i]) {
                correct++;
            }
        }
        
        this.testQuestion.style.display = 'none';
        const testFooter = document.querySelector('.test-footer');
        if (testFooter) testFooter.style.display = 'none';
        this.testResult.style.display = 'block';
        this.resultScore.textContent = `${correct}/${this.testState.total}`;
    }
    
    restartTest() {
        this.testCurrent = 1;
        this.testAnswers = {};
        this.testState.answers = {};
        
        this.testQuestion.style.display = 'block';
        const testFooter = document.querySelector('.test-footer');
        if (testFooter) testFooter.style.display = 'flex';
        this.testResult.style.display = 'none';
        
        this.loadTestQuestion(1);
    }
    
    setupSimulator() {
        this.setupSimulator3D();
    }
    
    setupSimulator3D() {
        if (typeof THREE === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
            script.onload = () => {
                this.init3DSimulator();
            };
            document.head.appendChild(script);
        } else {
            this.init3DSimulator();
        }
    }
    
    init3DSimulator() {
        if (this.currentChapter === 12) {
            if (this.simulator3D) {
                this.simulator3D.stop();
                this.simulator3D = null;
            }
            
            setTimeout(() => {
                this.simulator3D = new LatheSimulator3D();
                
                const startBtn = document.getElementById('startSimulation3d');
                const stopBtn = document.getElementById('stopSimulation3d');
                const resetBtn = document.getElementById('resetSimulation3d');
                
                if (startBtn) {
                    const newStartBtn = startBtn.cloneNode(true);
                    startBtn.parentNode.replaceChild(newStartBtn, startBtn);
                    
                    newStartBtn.addEventListener('click', () => {
                        if (this.simulator3D) this.simulator3D.start();
                    });
                }
                
                if (stopBtn) {
                    const newStopBtn = stopBtn.cloneNode(true);
                    stopBtn.parentNode.replaceChild(newStopBtn, stopBtn);
                    
                    newStopBtn.addEventListener('click', () => {
                        if (this.simulator3D) this.simulator3D.stop();
                    });
                }
                
                if (resetBtn) {
                    const newResetBtn = resetBtn.cloneNode(true);
                    resetBtn.parentNode.replaceChild(newResetBtn, resetBtn);
                    
                    newResetBtn.addEventListener('click', () => {
                        if (this.simulator3D) {
                            this.simulator3D.stop();
                            this.simulator3D.reset();
                        }
                    });
                }
            }, 100);
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new LatheTextbook();
});