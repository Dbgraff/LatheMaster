// LatheTextbook.js
import { chaptersData } from './data.js';
import { LatheSimulator3D } from './LatheSimulator3D.js';

export class LatheTextbook {
    constructor() {
        this.currentChapter = 1;
        this.totalChapters = 10;
        this.completedChapters = 1;

        // DOM элементы
        this.navItems = document.querySelectorAll('.nav-item');
        this.prevBtn = document.getElementById('prevChapterBtn');
        this.nextBtn = document.getElementById('nextChapterBtn');
        this.currentChapterDisplay = document.getElementById('currentChapterDisplay');
        this.progressFill = document.getElementById('progressFill');
        this.progressPercent = document.getElementById('progressPercent');
        this.progressText = document.getElementById('progressText');
        this.infoModal = document.getElementById('info-modal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalBody = document.getElementById('modal-body');
        this.closeModalBtn = document.querySelector('.modal-close');
        this.infoToggle = document.getElementById('info-toggle');
        this.viewerContainer = document.getElementById('viewer-container');
        this.testContainer = document.getElementById('test-container');
        this.simulatorContainer = document.getElementById('simulator-container');

        // Three.js элементы
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.mixer = null;
        this.clock = new THREE.Clock();

        // Симулятор
        this.simulator = null;

        this.initThree();
        this.setupEventListeners();
        this.switchChapter(1); // начать с первой главы
    }

    initThree() {
        const container = document.getElementById('threejs-viewer');
        if (!container) return;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0d14);

        this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.camera.position.set(3, 2, 5);
        this.camera.lookAt(0, 1, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setPixelRatio(window.devicePixelRatio);
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

        const gridHelper = new THREE.GridHelper(8, 20, 0x88aadd, 0x335577);
        gridHelper.position.y = 0;
        this.scene.add(gridHelper);

        // Контроллер
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.autoRotate = false;
        this.controls.enableZoom = true;
        this.controls.target.set(0, 1, 0);

        // Загрузка FBX модели
        const loader = new THREE.FBXLoader();
        loader.load('models/lathe.FBX', (object) => {
            this.model = object;
            this.model.scale.setScalar(0.001);
            //this.model.rotation.y = -Math.PI / 2; // при необходимости
            this.model.position.set(-2, 0, 0);
            this.scene.add(this.model);

            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.mixer = new THREE.AnimationMixer(this.model);
        }, undefined, (error) => {
            console.error('Ошибка загрузки модели:', error);
            this.addPlaceholderModel();
        });

        window.addEventListener('resize', () => this.onWindowResize());
        this.animate();
    }

    addPlaceholderModel() {
        const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 1.5), mat);
        base.position.set(0, 0.1, 0);
        this.scene.add(base);

        const headstock = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xe67e22 }));
        headstock.position.set(-2, 0.7, 0);
        this.scene.add(headstock);

        const tailstock = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xe67e22 }));
        tailstock.position.set(2, 0.7, 0);
        this.scene.add(tailstock);

        const carriage = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 1), new THREE.MeshStandardMaterial({ color: 0x27ae60 }));
        carriage.position.set(0, 0.5, 0.5);
        this.scene.add(carriage);
    }

    onWindowResize() {
        const container = document.getElementById('threejs-viewer');
        if (!container) return;
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        if (this.mixer) this.mixer.update(delta);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    flyTo(targetPos, targetLook) {
        const duration = 1.5;
        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        const endPos = new THREE.Vector3(targetPos[0], targetPos[1], targetPos[2]);
        const endTarget = new THREE.Vector3(targetLook[0], targetLook[1], targetLook[2]);

        let startTime = null;

        const animateCamera = (time) => {
            if (!startTime) startTime = time;
            const elapsed = (time - startTime) / 1000;
            const t = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);

            this.camera.position.lerpVectors(startPos, endPos, eased);
            this.controls.target.lerpVectors(startTarget, endTarget, eased);
            this.controls.update();

            if (t < 1) {
                requestAnimationFrame(animateCamera);
            }
        };
        requestAnimationFrame(animateCamera);
    }

    showInfoModal(chapter) {
        const data = chaptersData[chapter];
        if (!data) return;

        this.modalTitle.textContent = data.title;

        let html = '';
        if (data.content) {
            html = data.content;
        } else {
            html = `
                <div class="info-card">
                    <h3>${data.title}</h3>
                    <p>${data.description}</p>
                    <h4>Основные элементы:</h4>
                    <ul>${data.elements.map(el => `<li>${el}</li>`).join('')}</ul>
                    <div class="modal-specs"><strong>Характеристики:</strong> ${data.specs}</div>
                </div>
            `;
        }
        this.modalBody.innerHTML = html;
        this.infoModal.classList.add('show');
    }

    switchChapter(num) {
        if (num < 1 || num > this.totalChapters) return;

        // Обновить активное меню
        this.navItems.forEach(item => {
            item.classList.remove('active');
            if (parseInt(item.dataset.chapter) === num) {
                item.classList.add('active');
            }
        });

        this.currentChapter = num;
        this.currentChapterDisplay.textContent = num;
        this.prevBtn.disabled = num === 1;
        this.nextBtn.disabled = num === this.totalChapters;

        // Прогресс
        if (num > this.completedChapters) {
            this.completedChapters = num;
            const percent = (this.completedChapters / this.totalChapters) * 100;
            this.progressFill.style.width = percent + '%';
            this.progressPercent.textContent = Math.round(percent) + '%';
            this.progressText.textContent = `${this.completedChapters} из ${this.totalChapters} глав`;
        }

        // Управление видимостью контейнеров
        if (num === 9) { // тест
            this.viewerContainer.style.display = 'none';
            this.testContainer.style.display = 'flex';
            this.simulatorContainer.style.display = 'none';
            this.infoModal.classList.remove('show');
        } else if (num === 10) { // симулятор
            this.viewerContainer.style.display = 'none';
            this.testContainer.style.display = 'none';
            this.simulatorContainer.style.display = 'flex';
            this.infoModal.classList.remove('show');
            // Инициализация симулятора, если ещё не создан
            if (!this.simulator) {
                this.simulator = new LatheSimulator3D('simulator-canvas');
            }
        } else {
            this.viewerContainer.style.display = 'block';
            this.testContainer.style.display = 'none';
            this.simulatorContainer.style.display = 'none';
            this.showInfoModal(num);

            // Камера: для глав 2-5 особые позиции
            const targets = {
                2: { pos: [0, 2, 5], target: [0, 1, -0.45] },    // станина
                3: { pos: [-2, 1.5, 3], target: [-1, 1, -0.45] }, // передняя бабка
                4: { pos: [3, 1.5, 1], target: [1, 1.4, -0.45] },   // задняя бабка
                5: { pos: [0, 1.5, 2], target: [0, 1.2, -0.25] }, // суппорт
            };
            if (targets[num]) {
                this.flyTo(targets[num].pos, targets[num].target);
            } else {
                this.flyTo([3, 2, 5], [0, 1, 0]); // общий вид
            }
        }
    }

    setupEventListeners() {
        this.navItems.forEach(item => {
            item.addEventListener('click', () => {
                const chapter = parseInt(item.dataset.chapter);
                this.switchChapter(chapter);
            });
        });

        this.prevBtn.addEventListener('click', () => {
            if (this.currentChapter > 1) this.switchChapter(this.currentChapter - 1);
        });

        this.nextBtn.addEventListener('click', () => {
            if (this.currentChapter < this.totalChapters) this.switchChapter(this.currentChapter + 1);
        });

        this.closeModalBtn.addEventListener('click', () => {
            this.infoModal.classList.remove('show');
        });

        window.addEventListener('click', (e) => {
            if (e.target === this.infoModal) {
                this.infoModal.classList.remove('show');
            }
        });

        this.infoToggle.addEventListener('click', () => {
            if (this.currentChapter <= 8) { // кроме теста и симулятора
                this.showInfoModal(this.currentChapter);
            }
        });

        // Кнопки симулятора (будут подключены после создания)
        // Их обработчики можно добавить позже или внутри LatheSimulator3D
    }
}