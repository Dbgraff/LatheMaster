// LatheTextbook.js
import { partsData, questions, correctAnswers } from './data.js';
import { LatheSimulator3D } from './LatheSimulator3D.js';

export class LatheTextbook {
    constructor() {
        this.currentChapter = 1;
        this.totalChapters = 12;
        this.completedChapters = 1;
        
        this.testState = {
            current: 1,
            total: 5,
            answers: {},
            correct: correctAnswers
        };
        
        this.partsData = partsData;
        this.questions = questions;
        
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