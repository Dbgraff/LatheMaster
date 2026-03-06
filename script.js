// Проверка наличия Three.js и его загрузка при необходимости
if (typeof THREE === 'undefined') {
    console.log('Three.js will be loaded dynamically');
}

// 2.5D симулятор с Three.js
class LatheSimulator3D {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.animationId = null;
        
        this.workpiece = null;
        this.tool = null;
        this.headstock = null;
        this.tailstock = null;
        this.bed = null;
        
        this.rotationSpeed = 0.02;
        this.feedRate = 0.008;
        this.toolPosition = 0.4; // Начинаем от задней бабки с отступом
        this.maxToolTravel = 2.6; // Ограничиваем до передней бабки с отступом
        this.minToolTravel = 0.4; // Отступ от задней бабки
        
        // Прогресс обработки
        this.materialRemoved = new Array(20).fill(0);
        this.currentSegment = 0;
        
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
        
        // Lights
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
        
        // Bed (Станина)
        const bedGroup = new THREE.Group();
        
        const bedBeam = new THREE.BoxGeometry(6, 0.3, 1.2);
        const bedMesh = new THREE.Mesh(bedBeam, metalMaterial);
        bedMesh.position.set(-0.5, 0.15, 0);
        bedMesh.castShadow = true;
        bedMesh.receiveShadow = true;
        bedGroup.add(bedMesh);
        
        const wayGeo = new THREE.BoxGeometry(6, 0.15, 0.25);
        const way1 = new THREE.Mesh(wayGeo, accentMaterial);
        way1.position.set(-0.5, 0.4, -0.4);
        way1.castShadow = true;
        way1.receiveShadow = true;
        bedGroup.add(way1);
        
        const way2 = new THREE.Mesh(wayGeo, accentMaterial);
        way2.position.set(-0.5, 0.4, 0.4);
        way2.castShadow = true;
        way2.receiveShadow = true;
        bedGroup.add(way2);
        
        bedGroup.position.set(0, 0, 0);
        this.scene.add(bedGroup);
        this.bed = bedGroup;
        
        // Headstock (Передняя бабка) - слева
        const headstockGroup = new THREE.Group();
        
        const headstockBase = new THREE.BoxGeometry(1.2, 1.0, 1.2);
        const headstockMesh = new THREE.Mesh(headstockBase, accentMaterial);
        headstockMesh.position.set(-2.2, 0.7, 0);
        headstockMesh.castShadow = true;
        headstockMesh.receiveShadow = true;
        headstockGroup.add(headstockMesh);
        
        const spindleHousing = new THREE.CylinderGeometry(0.6, 0.6, 0.7, 12);
        const spindleMesh = new THREE.Mesh(spindleHousing, metalMaterial);
        spindleMesh.position.set(-1.5, 0.8, 0);
        spindleMesh.rotation.z = Math.PI / 2;
        spindleMesh.castShadow = true;
        spindleMesh.receiveShadow = true;
        headstockGroup.add(spindleMesh);
        
        // Chuck (Патрон)
        const chuckGroup = new THREE.Group();
        
        const chuckBody = new THREE.CylinderGeometry(0.7, 0.7, 0.6, 8);
        const chuckMesh = new THREE.Mesh(chuckBody, new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.3, metalness: 0.7 }));
        chuckMesh.position.set(-1.0, 0.8, 0);
        chuckMesh.rotation.z = Math.PI / 2;
        chuckMesh.castShadow = true;
        chuckMesh.receiveShadow = true;
        chuckGroup.add(chuckMesh);
        
        for (let i = 0; i < 3; i++) {
            const jawGeo = new THREE.BoxGeometry(0.15, 0.25, 0.25);
            const jaw = new THREE.Mesh(jawGeo, new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.2, metalness: 0.8 }));
            const angle = (i / 3) * Math.PI * 2;
            jaw.position.set(-1.0, 0.8 + Math.sin(angle) * 0.5, Math.cos(angle) * 0.5);
            jaw.castShadow = true;
            jaw.receiveShadow = true;
            chuckGroup.add(jaw);
        }
        
        headstockGroup.add(chuckGroup);
        this.scene.add(headstockGroup);
        this.headstock = headstockGroup;
        
        // Tailstock (Задняя бабка) - справа
        const tailstockGroup = new THREE.Group();
        
        const tailstockBase = new THREE.BoxGeometry(1.0, 0.9, 1.2);
        const tailstockMesh = new THREE.Mesh(tailstockBase, accentMaterial);
        tailstockMesh.position.set(2.2, 0.65, 0);
        tailstockMesh.castShadow = true;
        tailstockMesh.receiveShadow = true;
        tailstockGroup.add(tailstockMesh);
        
        const quillGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.7, 8);
        const quill = new THREE.Mesh(quillGeo, metalMaterial);
        quill.position.set(2.8, 0.8, 0);
        quill.rotation.z = Math.PI / 2;
        quill.castShadow = true;
        quill.receiveShadow = true;
        tailstockGroup.add(quill);
        
        const centerGeo = new THREE.ConeGeometry(0.2, 0.4, 8);
        const center = new THREE.Mesh(centerGeo, new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.2, metalness: 0.9 }));
        center.position.set(3.1, 0.8, 0);
        center.rotation.z = -Math.PI / 2;
        center.castShadow = true;
        center.receiveShadow = true;
        tailstockGroup.add(center);
        
        this.scene.add(tailstockGroup);
        this.tailstock = tailstockGroup;
        
        // Workpiece (Заготовка) - по центру, ось X
        const workpieceMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x3498db, 
            roughness: 0.3, 
            metalness: 0.2
        });
        
        const workpieceGeo = new THREE.CylinderGeometry(0.25, 0.25, 3.0, 16);
        this.workpiece = new THREE.Mesh(workpieceGeo, workpieceMaterial);
        this.workpiece.position.set(-0.2, 0.8, 0); // Z = 0 (ось детали)
        this.workpiece.rotation.z = Math.PI / 2;
        this.workpiece.castShadow = true;
        this.workpiece.receiveShadow = true;
        this.scene.add(this.workpiece);
        
        // Торцевые заглушки
        const capMaterial = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.5 });
        const capGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.15, 12);
        
        const cap1 = new THREE.Mesh(capGeo, capMaterial);
        cap1.position.set(-1.7, 0.8, 0);
        cap1.rotation.z = Math.PI / 2;
        cap1.castShadow = true;
        cap1.receiveShadow = true;
        this.scene.add(cap1);
        
        const cap2 = new THREE.Mesh(capGeo, capMaterial);
        cap2.position.set(1.3, 0.8, 0);
        cap2.rotation.z = Math.PI / 2;
        cap2.castShadow = true;
        cap2.receiveShadow = true;
        this.scene.add(cap2);
        
        // Tool post and tool (Суппорт с резцом) - ПРАВИЛЬНОЕ ПОЛОЖЕНИЕ
        const toolGroup = new THREE.Group();
        
        // Суппорт (зеленое основание) - СТОИТ ПЕРЕД ДЕТАЛЬЮ (Z > 0)
        const toolPostBase = new THREE.BoxGeometry(0.8, 0.5, 1.0);
        const toolPostMesh = new THREE.Mesh(toolPostBase, new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.5 }));
        toolPostMesh.position.set(0, 0.5, 0.8); // Z = 0.8 (перед деталью)
        toolPostMesh.castShadow = true;
        toolPostMesh.receiveShadow = true;
        toolGroup.add(toolPostMesh);
        
        // Желтая каретка - ТОЖЕ ПЕРЕД ДЕТАЛЬЮ
        const carriageGeo = new THREE.BoxGeometry(0.6, 0.3, 0.7);
        const carriageMesh = new THREE.Mesh(carriageGeo, new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.3 }));
        carriageMesh.position.set(0.2, 0.9, 0.7); // Z = 0.7
        carriageMesh.castShadow = true;
        carriageMesh.receiveShadow = true;
        toolGroup.add(carriageMesh);
        
        // Резцедержатель
        const holderGeo = new THREE.BoxGeometry(0.3, 0.2, 0.4);
        const holderMesh = new THREE.Mesh(holderGeo, new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.4 }));
        holderMesh.position.set(0.6, 0.9, 0.5); // Z = 0.5
        holderMesh.castShadow = true;
        holderMesh.receiveShadow = true;
        toolGroup.add(holderMesh);
        
        // Резец - ВЫДВИНУТ К ДЕТАЛИ
        const cutterGeo = new THREE.ConeGeometry(0.1, 0.4, 6);
        this.tool = new THREE.Mesh(cutterGeo, toolMaterial);
        this.tool.position.set(0.8, 0.9, 0.3); // Z = 0.3 (ближе к детали)
        this.tool.rotation.x = Math.PI / 2;
        this.tool.castShadow = true;
        this.tool.receiveShadow = true;
        toolGroup.add(this.tool);
        
        // Наконечник - КАСАЕТСЯ ПОВЕРХНОСТИ ДЕТАЛИ (Z = 0.25)
        const tipGeo = new THREE.SphereGeometry(0.02, 4);
        const tip = new THREE.Mesh(tipGeo, new THREE.MeshStandardMaterial({ color: 0xffaa00 }));
        tip.position.set(0.95, 0.9, 0.25); // Z = 0.25 (точно на поверхности)
        toolGroup.add(tip);
        
        // Начальная позиция - У ЗАДНЕЙ БАБКИ, НО НЕ ВНУТРИ
        toolGroup.position.set(1.3, 0, 0); // Старт справа, с отступом от задней бабки
        
        this.scene.add(toolGroup);
        this.toolGroup = toolGroup;
        
        // Стружка
        this.chips = [];
        const chipMaterial = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.2, metalness: 0.8 });
        for (let i = 0; i < 15; i++) {
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
        this.toolPosition = this.minToolTravel;
        if (this.toolGroup) {
            this.toolGroup.position.x = 1.3; // У задней бабки
        }
        if (this.workpiece) {
            this.workpiece.scale.set(1, 1, 1);
            this.workpiece.material.color.setHex(0x3498db);
        }
        this.materialRemoved = new Array(20).fill(0);
        this.currentSegment = 0;
        
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
            this.feedRate = 0.005 * parseFloat(feedControl.value);
        }
        
        // Вращение заготовки
        if (this.workpiece) {
            this.workpiece.rotation.x += this.rotationSpeed;
        }
        
        // Движение резца ОТ ЗАДНЕЙ БАБКИ К ПЕРЕДНЕЙ (СПРАВА НАЛЕВО)
        if (this.toolGroup) {
            if (this.toolPosition < this.maxToolTravel) {
                this.toolPosition += this.feedRate;
                
                // Плавное движение от x = 1.3 до x = -1.1
                const xPos = 1.3 - (this.toolPosition - this.minToolTravel) / (this.maxToolTravel - this.minToolTravel) * 2.4;
                this.toolGroup.position.x = xPos;
                
                // Определяем сегмент детали
                const segment = Math.floor((this.toolPosition - this.minToolTravel) / (this.maxToolTravel - this.minToolTravel) * 20);
                
                // Обновляем прогресс для текущего сегмента
                if (segment < 20 && segment >= 0 && segment !== this.currentSegment) {
                    this.currentSegment = segment;
                    if (this.materialRemoved[segment] < 0.7) {
                        this.materialRemoved[segment] += 0.02;
                    }
                }
                
                // Вычисляем средний прогресс
                let totalProgress = 0;
                for (let i = 0; i < 20; i++) {
                    totalProgress += this.materialRemoved[i];
                }
                const avgProgress = totalProgress / 20;
                
                // Уменьшаем диаметр (но не длину!)
                const diameterScale = 1 - avgProgress * 0.3;
                this.workpiece.scale.set(diameterScale, diameterScale, 1);
                
                // Меняем цвет от синего к серебристому
                const color = new THREE.Color().lerpColors(
                    new THREE.Color(0x3498db),
                    new THREE.Color(0xbdc3c7),
                    avgProgress
                );
                this.workpiece.material.color.set(color);
                
                // Стружка
                if (Math.random() < 0.1 && avgProgress > 0.1) {
                    const chip = this.chips.find(c => !c.visible);
                    if (chip) {
                        chip.position.set(
                            this.toolGroup.position.x + 0.5,
                            0.9 + Math.random() * 0.3,
                            0.4 + Math.random() * 0.3
                        );
                        chip.rotation.set(Math.random(), Math.random(), Math.random());
                        chip.visible = true;
                        
                        setTimeout(() => {
                            if (chip) chip.visible = false;
                        }, 300);
                    }
                }
            } else {
                // Дошли до передней бабки - возвращаемся к задней
                this.toolPosition = this.minToolTravel;
            }
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

class LatheTextbook {
    constructor() {
        this.currentChapter = 1;
        this.totalChapters = 11;
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
        
        // Данные для интерактивных частей
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
        // Menu clicks
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const chapter = e.currentTarget.dataset.chapter;
                this.switchChapter(parseInt(chapter));
            });
        });
        
        // Prev/Next buttons
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
        
        // Hide all chapters
        document.querySelectorAll('.chapter').forEach(ch => {
            ch.classList.remove('active');
        });
        
        // Show selected chapter
        const chapter = document.getElementById(`chapter${num}`);
        if (chapter) chapter.classList.add('active');
        
        // Update menu
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`.nav-item[data-chapter="${num}"]`);
        if (activeItem) activeItem.classList.add('active');
        
        // Update current
        this.currentChapter = num;
        document.getElementById('currentChapterDisplay').textContent = num;
        
        // Update buttons
        document.getElementById('prevChapterBtn').disabled = num === 1;
        document.getElementById('nextChapterBtn').disabled = num === this.totalChapters;
        
        // Update progress
        if (num > this.completedChapters) {
            this.completedChapters = num;
            this.updateProgress();
        }
        
        // Scroll to top
        document.querySelector('.main-content').scrollTop = 0;
        
        // Handle simulators
        if (num === 11) {
            // Старый canvas симулятор
            if (this.ctx) {
                this.startSimulator();
            }
            // Новый 3D симулятор
            this.init3DSimulator();
        } else {
            // Останавливаем старый симулятор
            this.stopSimulator();
            // Останавливаем новый 3D симулятор
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
        // Делаем строки таблицы кликабельными
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
        
        // Close button
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.modal.classList.remove('show');
        });
        
        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.modal.classList.remove('show');
            }
        });
        
        // ESC key
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
        
        // Build list
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
        
        // Elements
        this.testProgress = document.getElementById('testProgress');
        this.testCounter = document.getElementById('testCounter');
        this.testQuestion = document.getElementById('testQuestion');
        this.testPrev = document.getElementById('testPrev');
        this.testNext = document.getElementById('testNext');
        this.testSubmit = document.getElementById('testSubmit');
        this.testResult = document.getElementById('testResult');
        this.resultScore = document.getElementById('resultScore');
        this.testRestart = document.getElementById('testRestart');
        
        // Questions data
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
        
        // Event listeners
        this.testPrev.addEventListener('click', () => this.prevQuestion());
        this.testNext.addEventListener('click', () => this.nextQuestion());
        this.testSubmit.addEventListener('click', () => this.submitTest());
        this.testRestart.addEventListener('click', () => this.restartTest());
        
        // Load first question
        this.loadTestQuestion(1);
    }
    
    loadTestQuestion(num) {
        const question = this.questions[num];
        if (!question) return;
        
        // Update progress bar
        this.testProgress.style.width = (num / this.testState.total * 100) + '%';
        this.testCounter.textContent = `${num}/${this.testState.total}`;
        
        // Build question HTML
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
        
        // Add event listeners to radio buttons
        document.querySelectorAll(`.test-option input[name="q${num}"]`).forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.testAnswers[num] = e.target.value;
                this.testState.answers[num] = e.target.value;
            });
        });
        
        // Update buttons
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
            // Save answer for current question
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
        // Save last answer
        const selected = document.querySelector(`input[name="q${this.testCurrent}"]:checked`);
        if (selected) {
            this.testAnswers[this.testCurrent] = selected.value;
            this.testState.answers[this.testCurrent] = selected.value;
        }
        
        // Calculate score
        let correct = 0;
        for (let i = 1; i <= this.testState.total; i++) {
            if (this.testAnswers[i] === this.testState.correct[i]) {
                correct++;
            }
        }
        
        // Show result
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
        
        // Reset UI
        this.testQuestion.style.display = 'block';
        const testFooter = document.querySelector('.test-footer');
        if (testFooter) testFooter.style.display = 'flex';
        this.testResult.style.display = 'none';
        
        // Load first question
        this.loadTestQuestion(1);
    }
    
    setupSimulator() {
        // Старый canvas симулятор
        const canvas = document.getElementById('latheSimulator');
        if (canvas) {
            this.ctx = canvas.getContext('2d');
            this.animationId = null;
            this.workpieceRotation = 0;
            this.toolPosition = 0;

            const startBtn = document.getElementById('startSimulation');
            const stopBtn = document.getElementById('stopSimulation');
            
            if (startBtn) {
                startBtn.addEventListener('click', () => this.startSimulator());
            }
            if (stopBtn) {
                stopBtn.addEventListener('click', () => this.stopSimulator());
            }
        }
        
        // Новый 3D симулятор
        this.setupSimulator3D();
    }
    
    setupSimulator3D() {
        // Проверяем, загружена ли библиотека Three.js
        if (typeof THREE === 'undefined') {
            // Загружаем Three.js динамически
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
        // Создаем экземпляр 3D симулятора только если мы на главе 11
        if (this.currentChapter === 11) {
            if (this.simulator3D) {
                this.simulator3D.stop();
            }
            this.simulator3D = new LatheSimulator3D();
            
            // Подключаем кнопки управления
            setTimeout(() => {
                const startBtn = document.getElementById('startSimulation3d');
                const stopBtn = document.getElementById('stopSimulation3d');
                const resetBtn = document.getElementById('resetSimulation3d');
                
                if (startBtn) {
                    // Удаляем старые обработчики
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
    
    startSimulator() {
        if (this.animationId) return;

        const animate = () => {
            if (!this.ctx) return;
            
            this.ctx.clearRect(0, 0, 800, 400);

            // Станина
            this.ctx.fillStyle = '#95A5A6';
            this.ctx.fillRect(50, 250, 700, 50);

            // Передняя бабка
            this.ctx.fillStyle = '#E67E22';
            this.ctx.fillRect(80, 100, 130, 150);

            // Патрон
            this.ctx.fillStyle = '#7F8C8D';
            this.ctx.beginPath();
            this.ctx.arc(240, 200, 40, 0, 2 * Math.PI);
            this.ctx.fill();

            // Заготовка
            this.ctx.save();
            this.ctx.translate(240, 200);
            this.ctx.rotate(this.workpieceRotation);
            this.ctx.fillStyle = '#3498DB';
            this.ctx.fillRect(0, -10, 400, 20);
            this.ctx.restore();

            // Задняя бабка
            this.ctx.fillStyle = '#E67E22';
            this.ctx.fillRect(640, 110, 110, 140);

            // Суппорт
            this.ctx.fillStyle = '#27AE60';
            this.ctx.fillRect(300 + this.toolPosition, 200, 80, 50);

            // Резец
            this.ctx.fillStyle = '#E74C3C';
            this.ctx.beginPath();
            this.ctx.moveTo(380 + this.toolPosition, 200);
            this.ctx.lineTo(400 + this.toolPosition, 190);
            this.ctx.lineTo(400 + this.toolPosition, 210);
            this.ctx.fill();

            this.workpieceRotation += 0.1; // Вращение заготовки
            this.toolPosition += 0.5; // Движение резца
            if (this.toolPosition > 300) this.toolPosition = 0; // Сброс позиции

            this.animationId = requestAnimationFrame(animate);
        };

        animate();
    }
    
    stopSimulator() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new LatheTextbook();
});