class CalendarApp {
    constructor() {
        const now = new Date();
        this.currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
        this.endDate = new Date(2525, 11, 31); // 31 desembre 2525
        this.selectedBrother = null; // ID numèric del germà - inicialitzat a null
        this.selectedMode = null; // ID numèric de la modalitat - inicialitzat a null
        this.assignments = []; // Assignacions de l'API
        this.brothers = []; // Germans de l'API
        this.modalities = []; // Modalitats de l'API
        
        // Configurar URL base de l'API segons l'entorn
        this.apiBase = this.getApiBaseUrl();
        
        // Funcionalitat de selecció múltiple
        this.selectedCells = new Set(); // Conjunt de dates seleccionades
        this.isSelecting = false; // Si estem en procés d'arrossegament
        this.isDragging = false; // Per detectar arrossegament real
        this.startX = undefined; // Posició inicial X del mouse
        this.startY = undefined; // Posició inicial Y del mouse
        
        // Variables per controlar touch events
        this.touchInProgress = false;
        this.lastTouchTime = 0;
        this.debounceTimer = null;
        
        // Variables per controlar operacions concurrents
        this.processingMultipleAssignments = false;
        this.updatingCells = new Set();
        this.reloadingData = false;
        
        this.init();
    }

    // Determinar la URL base de l'API
    getApiBaseUrl() {
        // Sempre usar URL relativa ja que Flask serveix tant l'app com l'API
        return '/api/v1/calendar';
    }
    
    // Detectar si estem en entorn local o remot
    isLocalEnvironment() {
        return window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    }
    
    // Detectar si estem en entorn remot
    isRemoteEnvironment() {
        return window.location.hostname === '208.97.144.166';
    }

    // Verificar connexió amb el servidor
    async checkServerConnection() {
        try {
            const response = await fetch(`${this.apiBase}?ping=1`, {
                method: 'GET',
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            return response.ok;
        } catch (error) {
            console.error('Error verificant connexió:', error);
            return false;
        }
    }

    // Verificar si una operació ha sigut realment exitosa
    async verifyOperationSuccess(payload, expectedResult) {
        try {
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Recarregar dades per verificar l'estat
            await this.loadCalendarData(false);
            
            const dateKey = payload.date;
            const brotherId = payload.brother_id;
            const modalityId = payload.modality_id;
            const action = payload.action;
            
            // Verificar l'estat actual
            const checkDate = new Date(dateKey);
            const existingAssignments = this.assignments.filter(assignment => {
                const assignmentDate = new Date(assignment.data_assignacio);
                return assignmentDate.toDateString() === checkDate.toDateString();
            });
            
            const brotherAssignment = existingAssignments.find(assignment => {
                return parseInt(assignment.germa_id) === parseInt(brotherId);
            });
            
            if (action === 'add') {
                return brotherAssignment !== undefined;
            } else if (action === 'remove') {
                return brotherAssignment === undefined;
            }
            
            return true;
        } catch (error) {
            console.error('Error verificant operació:', error);
            return false;
        }
    }

    // Detectar si és un dispositiu mòbil
    isMobile() {
        // Millor detecció de dispositius mòbils
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth <= 768;
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobileUA = /android|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent);
        
        return isTouchDevice && (isSmallScreen || isMobileUA);
    }

    // Detectar si el dispositiu suporta touch
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    // Obtenir text curt per modalitat en mòbils
    getShortModalityText(modalityName) {
        if (!this.isMobile()) {
            return modalityName;
        }
        
        // Textos curts per a mòbils
        if (modalityName === 'Seré al poble' || modalityName === 'Al poble') {
            return 'Al poble';
        }
        if (modalityName === 'Seré a casa' || modalityName === 'A casa') {
            return 'A casa';
        }
        if (modalityName === 'A casa de la mare') {
            return 'A casa';
        }
        
        return modalityName;
    }

    getShortName(fullName) {
        if (!this.isMobile()) {
            return fullName;
        }
        
        // Noms curts per a mòbils
        if (fullName === 'Rosa Maria') {
            return 'Rosa M.';
        }
        
        // Per a altres noms, retornar només el primer nom
        return fullName.split(' ')[0];
    }

    init() {
        this.setupEventListeners();
        
        this.loadCalendarData();
        this.updateCurrentMonthDisplay();
    }

    async loadCalendarData(showSpinner = true) {
        if (showSpinner) {
            this.showSpinner('Carregant calendari...');
        }
        
        // Log per identificar l'entorn
        console.log(`🌍 Carregant dades en entorn: ${this.isLocalEnvironment() ? 'LOCAL' : 'REMOT'} (${window.location.hostname})`);
        
        // Retry logic per assegurar que les dades es carreguin correctament
        let retries = 3;
        let lastError = null;
        
        while (retries > 0) {
            try {
                // Usar només timestamp simple sense cache-busting agressiu
                const timestamp = Date.now();
                const requestUrl = `${this.apiBase}?t=${timestamp}`;
                
                console.log(`📡 Petició a: ${requestUrl}`);
                
                const response = await fetch(requestUrl, {
                    method: 'GET',
                    cache: 'no-cache',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const result = await response.json();
                if (result.success) {
                    // Verificar que les dades són vàlides
                    if (!result.assignments || !result.brothers || !result.modalities) {
                        throw new Error('Dades incompletes del servidor');
                    }
                    
                    // Actualitzar les dades locals només si són vàlides
                    this.assignments = result.assignments || [];
                    this.brothers = result.brothers || [];
                    this.modalities = result.modalities || [];
                    
                    console.log(`✅ Dades carregades: ${this.assignments.length} assignacions, ${this.brothers.length} germans, ${this.modalities.length} modalitats`);
                    
                    // Log específic per a debugging
                    if (this.assignments.length > 0) {
                        console.log(`📋 Primeres 3 assignacions:`, this.assignments.slice(0, 3));
                    }
                    
                    // Processar informació de darrera modificació
                    if (result.last_modification) {
                        this.updateLastModificationDisplay(result.last_modification);
                    }
                    
                    // Establir valors per defecte només si no hi ha cap selecció prèvia
                    if (this.brothers.length > 0 && this.selectedBrother === null) {
                        this.selectedBrother = this.brothers[0].id;
                    }
                    if (this.modalities.length > 0 && this.selectedMode === null) {
                        this.selectedMode = this.modalities[0].id;
                    }
                    
                    this.populateSelectors();
                    this.renderCalendar();
                    
                    if (showSpinner) {
                        this.hideSpinner();
                    }
                    return; // Sortir del bucle si tot ha anat bé
                } else {
                    throw new Error(result.error || 'Error desconegut del servidor');
                }
            } catch (error) {
                console.error(`Error carregant dades (intent ${4 - retries}):`, error);
                lastError = error;
                retries--;
                
                if (retries > 0) {
                    // Esperar abans del següent intent
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        // Si hem arribat aquí, tots els intents han fallat
        console.error('Error carregant dades després de 3 intents:', lastError);
        if (showSpinner) {
            this.hideSpinner();
            await this.showInfoModal('Error', 'Error carregant les dades del calendari després de múltiples intents. Es mostrarà un calendari buit.');
        }
        this.renderCalendar();
    }

    setupEventListeners() {
        // Selectors
        document.getElementById('brother-select').addEventListener('change', (e) => {
            this.selectedBrother = parseInt(e.target.value);
        });

        document.getElementById('mode-select').addEventListener('change', (e) => {
            this.selectedMode = parseInt(e.target.value);
        });

        // Navegació
        document.getElementById('prev-month').addEventListener('click', () => {
            this.previousMonth();
        });

        document.getElementById('next-month').addEventListener('click', () => {
            this.nextMonth();
        });

        // Controls de selecció múltiple
        document.getElementById('assign-selected').addEventListener('click', () => {
            this.assignSelectedCells();
        });

        document.getElementById('clear-selection').addEventListener('click', () => {
            this.clearSelection();
        });

        document.getElementById('clear-assigned').addEventListener('click', () => {
            this.clearAssignedCells();
        });

        // Event listeners per detectar tecles
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.selectedCells.size > 0) {
                this.clearSelection();
            }
        });

        // Event listener per netegar selecció quan es faci clic fora del calendari
        document.addEventListener('click', (e) => {
            // Si el clic no és dins del calendari o dels botons de control
            if (!e.target.closest('.calendar-container') && 
                !e.target.closest('.multi-select-controls') &&
                !e.target.closest('.modal') &&
                this.selectedCells.size > 0) {
                this.clearSelection();
            }
        });

        // Event listener global per acabar l'arrossegament (només desktop)
        document.addEventListener('mouseup', (e) => {
            if (!this.isMobile() && this.isSelecting) {
                // Si no hem arrossegat, és un clic simple - resetar immediatament
                if (!this.isDragging) {
                    this.isSelecting = false;
                    this.isDragging = false;
                    this.startX = undefined;
                    this.startY = undefined;
                } else {
                    // Si hem arrossegat, finalitzar la selecció
                    this.isSelecting = false;
                    this.isDragging = false;
                    this.startX = undefined;
                    this.startY = undefined;
                }
            }
        });
        
        // Event listeners de touch per a mòbils (eliminats per usar sistema diferent)
        document.addEventListener('touchend', (e) => {
            // Només resetar si estem en desktop i usant el sistema d'arrossegament
            if (!this.isMobile() && this.isSelecting) {
                if (!this.isDragging) {
                    this.isSelecting = false;
                    this.isDragging = false;
                    this.startX = undefined;
                    this.startY = undefined;
                } else {
                    this.isSelecting = false;
                    this.isDragging = false;
                    this.startX = undefined;
                    this.startY = undefined;
                }
            }
        });
        
        // Event listener per detectar moviment durant l'arrossegament (només desktop)
        document.addEventListener('mousemove', (e) => {
            if (!this.isMobile() && this.isSelecting && this.startX !== undefined && this.startY !== undefined) {
                const deltaX = Math.abs(e.clientX - this.startX);
                const deltaY = Math.abs(e.clientY - this.startY);
                
                // Marcar com a arrossegament si hi ha moviment significatiu
                if (deltaX > 3 || deltaY > 3) {
                    if (!this.isDragging) {
                        // Primer cop que detectem arrossegament - iniciar selecció
                        this.isDragging = true;
                        // Trobar l'element inicial i afegir-lo a la selecció
                        const initialElement = document.elementFromPoint(this.startX, this.startY);
                        if (initialElement && initialElement.closest('.calendar-day')) {
                            const dayElement = initialElement.closest('.calendar-day');
                            const dayNumber = dayElement.querySelector('.day-number');
                            if (dayNumber) {
                                const dayNum = parseInt(dayNumber.textContent);
                                const initialDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), dayNum);
                                this.handleMultiSelectClick(initialDate, dayElement);
                            }
                        }
                    }
                }
            }
        });
    }

    populateSelectors() {
        // Poblar selector de germans
        const brotherSelect = document.getElementById('brother-select');
        brotherSelect.innerHTML = '';
        this.brothers.forEach(brother => {
            const option = document.createElement('option');
            option.value = brother.id;
            option.textContent = brother.nom;
            if (brother.id === this.selectedBrother) {
                option.selected = true;
            }
            brotherSelect.appendChild(option);
        });

        // Poblar selector de modalitats
        const modeSelect = document.getElementById('mode-select');
        modeSelect.innerHTML = '';
        this.modalities.forEach(modality => {
            const option = document.createElement('option');
            option.value = modality.id;
            option.textContent = modality.nom;
            if (modality.id === this.selectedMode) {
                option.selected = true;
            }
            modeSelect.appendChild(option);
        });
    }

    renderCalendar() {
        const calendar = document.getElementById('calendar');
        
        // Netejar completament el calendari abans de re-renderitzar
        calendar.innerHTML = '';
        
        // Forçar reflow per assegurar neteja completa
        calendar.offsetHeight;
        
        console.log(`🔄 Renderitzant calendari amb ${this.assignments.length} assignacions`);

        // Headers dels dies de la setmana
        const weekdays = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte', 'Diumenge'];
        weekdays.forEach(day => {
            const header = document.createElement('div');
            header.className = 'calendar-header';
            header.textContent = day;
            calendar.appendChild(header);
        });

        // Obtenir el primer dia del mes i l'últim
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        
        // Ajustar el primer dia per començar en dilluns (1)
        const startDate = new Date(firstDay);
        const firstDayOfWeek = firstDay.getDay();
        const daysToSubtract = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
        startDate.setDate(startDate.getDate() - daysToSubtract);

        // Renderitzar els dies
        const today = new Date();
        for (let i = 0; i < 42; i++) { // 6 setmanes × 7 dies
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + i);
            
            const dayElement = this.createDayElement(cellDate, today);
            calendar.appendChild(dayElement);
        }
        
        console.log(`✅ Calendari renderitzat amb ${calendar.children.length} elements`);
    }

    createDayElement(date, today) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        // Afegir atribut data-date per poder trobar la cel·la després
        dayElement.setAttribute('data-date', this.getDateKey(date));
        
        const isCurrentMonth = date.getMonth() === this.currentDate.getMonth();
        const isToday = date.toDateString() === today.toDateString();
        const isValidDate = date >= new Date(2025, 6, 1) && date <= this.endDate;

        if (!isCurrentMonth) {
            dayElement.classList.add('other-month');
        }

        if (isToday) {
            dayElement.classList.add('today');
        }

        // Número del dia
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = date.getDate();
        dayElement.appendChild(dayNumber);

        // Assignments
        const assignmentsContainer = document.createElement('div');
        assignmentsContainer.className = 'day-assignments';
        dayElement.appendChild(assignmentsContainer);

        // Mostrar assignacions existents
        const dateKey = this.getDateKey(date);
        const dayAssignments = this.assignments.filter(assignment => {
            const assignmentDate = new Date(assignment.data_assignacio);
            const checkDate = new Date(date);
            return assignmentDate.toDateString() === checkDate.toDateString();
        });
        
        if (dayAssignments.length > 0) {
            dayElement.classList.add('has-assignment');
            
            if (dayAssignments.length === 1) {
                // Una sola assignació - aplicar color del germà
                const assignment = dayAssignments[0];
                
                // Afegir classe per al color del germà
                dayElement.classList.add(`brother-${assignment.germa_id}`);
                
                const assignmentEl = document.createElement('div');
                assignmentEl.className = 'assignment';
                
                // En mòbil, mostrar nom curt
                const displayName = this.getShortName(assignment.nom_germa);
                
                assignmentEl.textContent = displayName;
                assignmentEl.title = `${assignment.nom_germa} - ${assignment.nom_modalitat}`;
                
                const modalityEl = document.createElement('div');
                modalityEl.className = 'assignment-modality';
                modalityEl.textContent = this.getShortModalityText(assignment.nom_modalitat);
                
                assignmentsContainer.appendChild(assignmentEl);
                assignmentsContainer.appendChild(modalityEl);
                
            } else {
                // Múltiples assignacions - color taronja pastel
                dayElement.classList.add('has-multiple-assignments');
                assignmentsContainer.classList.add('multiple-assignments');
                
                // Crear llista de noms dels germans
                const brotherNames = dayAssignments.map(a => a.nom_germa).join(', ');
                const modalities = [...new Set(dayAssignments.map(a => a.nom_modalitat))];
                
                // Mostrar noms dels germans
                dayAssignments.forEach(assignment => {
                    const assignmentEl = document.createElement('div');
                    assignmentEl.className = 'assignment';
                    
                    // En mòbil, mostrar nom curt
                    const displayName = this.getShortName(assignment.nom_germa);
                    
                    assignmentEl.textContent = displayName;
                    assignmentEl.title = `${assignment.nom_germa} - ${assignment.nom_modalitat}`;
                    assignmentsContainer.appendChild(assignmentEl);
                });
                
                // Mostrar modalitat comuna (assumint que tots tenen la mateixa modalitat)
                if (modalities.length === 1) {
                    const modalityEl = document.createElement('div');
                    modalityEl.className = `assignment-modality ${modalities[0].toLowerCase()}`;
                    modalityEl.textContent = this.getShortModalityText(modalities[0]);
                    assignmentsContainer.appendChild(modalityEl);
                }
            }
        }

        // Event listener per afegir/eliminar assignments
        if (isValidDate && isCurrentMonth) {
            let touchTimer = null;
            let longPressActivated = false;
            
            dayElement.addEventListener('click', (e) => {
                // En dispositius tàctils, evitar clicks duplicats després de touch
                if (this.isTouchDevice()) {
                    const now = Date.now();
                    if (now - this.lastTouchTime < 500) {
                        e.preventDefault();
                        return;
                    }
                }
                
                // En mòbils, si acabem de fer un touchend, evitar el click duplicate
                if (this.isMobile() && longPressActivated) {
                    e.preventDefault();
                    return;
                }
                
                // Si es fa Ctrl+clic, sempre fer selecció múltiple
                if (e.ctrlKey || e.metaKey) {
                    this.handleMultiSelectClick(date, dayElement, e);
                    return;
                }
                
                // En mòbils, si ja estem en mode selecció múltiple, continuar seleccionant
                if (this.isMobile() && this.selectedCells.size > 0) {
                    this.handleMultiSelectClick(date, dayElement, e);
                    return;
                }
                
                // Si no hi ha cel·les seleccionades, fer assignació directa
                if (this.selectedCells.size === 0) {
                    this.toggleAssignment(date);
                } else {
                    // Si hi ha cel·les seleccionades, tractar com a selecció múltiple
                    this.handleMultiSelectClick(date, dayElement, e);
                }
            });

            // Event listeners per arrossegament en desktop
            if (!this.isMobile()) {
                dayElement.addEventListener('mousedown', (e) => {
                    // Només processar si no es fa Ctrl+clic
                    if (e.ctrlKey || e.metaKey) {
                        return;
                    }
                    
                    // No prevenir el comportament per defecte per permetre clics normals
                    // Inicialitzar arrossegament
                    this.isSelecting = true;
                    this.isDragging = false;
                    this.startX = e.clientX;
                    this.startY = e.clientY;
                    
                    // NO iniciar selecció aquí - esperar a veure si és arrossegament
                });

                dayElement.addEventListener('mouseenter', () => {
                    if (this.isSelecting && this.isDragging) {
                        // Només si estem realment arrossegant, afegir aquesta cel·la a la selecció
                        this.handleMultiSelectClick(date, dayElement);
                    } else if (!this.isSelecting) {
                        // Si no estem arrossegant, mostrar hover
                        dayElement.classList.add('multi-select-hover');
                    }
                });

                dayElement.addEventListener('mouseleave', () => {
                    dayElement.classList.remove('multi-select-hover');
                });
            } else {
                // Event listeners per a touch llarg en mòbils - millor gestió
                let touchStartTime = 0;
                let touchStartPos = null;
                let touchEnded = false;
                
                dayElement.addEventListener('touchstart', (e) => {
                    if (e.touches.length > 1) return; // Ignora multi-touch
                    
                    touchStartTime = Date.now();
                    touchStartPos = {
                        x: e.touches[0].clientX,
                        y: e.touches[0].clientY
                    };
                    touchEnded = false;
                    longPressActivated = false;
                    
                    // Timeout per a press llarg
                    touchTimer = setTimeout(() => {
                        if (!touchEnded && touchStartPos) {
                            longPressActivated = true;
                            // Iniciar selecció múltiple amb press llarg
                            this.handleMultiSelectClick(date, dayElement);
                            // Vibrar si és possible
                            if (navigator.vibrate) {
                                navigator.vibrate(100);
                            }
                            // Feedback visual
                            dayElement.style.transform = 'scale(0.95)';
                            setTimeout(() => {
                                dayElement.style.transform = '';
                            }, 100);
                        }
                    }, 300); // 300ms per a press llarg
                }, { passive: false });

                dayElement.addEventListener('touchend', (e) => {
                    touchEnded = true;
                    this.lastTouchTime = Date.now();
                    
                    if (touchTimer) {
                        clearTimeout(touchTimer);
                        touchTimer = null;
                    }
                    
                    // Si va ser un press llarg, no fer res més
                    if (longPressActivated) {
                        e.preventDefault();
                        longPressActivated = false;
                        return;
                    }
                    
                    // Si és un tap curt i no hi ha selecció múltiple activa, fer click normal
                    const touchDuration = Date.now() - touchStartTime;
                    if (touchDuration < 300 && this.selectedCells.size === 0) {
                        // Reset vars i processar com a click normal
                        touchStartTime = 0;
                        touchStartPos = null;
                        // Usar setTimeout per evitar conflictes amb altres events
                        setTimeout(() => {
                            this.toggleAssignment(date);
                        }, 10);
                    } else if (touchDuration < 300 && this.selectedCells.size > 0) {
                        // Si hi ha cel·les seleccionades, tractar com a selecció múltiple
                        setTimeout(() => {
                            this.handleMultiSelectClick(date, dayElement);
                        }, 10);
                    }
                }, { passive: false });

                dayElement.addEventListener('touchmove', (e) => {
                    if (touchTimer && touchStartPos) {
                        const currentPos = {
                            x: e.touches[0].clientX,
                            y: e.touches[0].clientY
                        };
                        const deltaX = Math.abs(currentPos.x - touchStartPos.x);
                        const deltaY = Math.abs(currentPos.y - touchStartPos.y);
                        
                        // Si hi ha moviment significant, cancel·lar el press llarg
                        if (deltaX > 10 || deltaY > 10) {
                            clearTimeout(touchTimer);
                            touchTimer = null;
                        }
                    }
                }, { passive: false });
            }
        }

        return dayElement;
    }

    async toggleAssignment(date) {
        const dateKey = this.getDateKey(date);
        const checkDate = new Date(date);
        
        // Buscar assignacions existents per aquesta data
        const existingAssignments = this.assignments.filter(assignment => {
            const assignmentDate = new Date(assignment.data_assignacio);
            return assignmentDate.toDateString() === checkDate.toDateString();
        });

        // Verificar si aquest germà ja està assignat aquest dia
        const currentBrotherAssignment = existingAssignments.find(assignment => {
            return parseInt(assignment.germa_id) === parseInt(this.selectedBrother);
        });
        
        // Obtenir informació de la modalitat seleccionada
        const selectedModality = this.modalities.find(m => m.id === this.selectedMode);
        
        if (currentBrotherAssignment) {
            // Si ja està assignat, eliminar-lo
            const payload = {
                date: dateKey,
                brother_id: this.selectedBrother,
                modality_id: currentBrotherAssignment.modalitat_id,
                action: 'remove'
            };
            
            const result = await this.executeAssignmentAction(payload, 'remove');
            return result;
        } else {
            // Si no està assignat, verificar si es pot afegir
            
            // Verificar si hi ha algú assignat "A casa" - si és així, no es pot assignar res més
            const casaAssignments = existingAssignments.filter(a => a.modality_code === 'casa');
            if (casaAssignments.length > 0) {
                const casaBrotherNames = casaAssignments.map(a => a.nom_germa).join(', ');
                await this.showInfoModal(
                    'No es pot assignar',
                    `Aquest dia ${casaBrotherNames} està a casa. No es pot assignar res més quan hi ha algú a casa.`
                );
                return { success: false, error: 'No es pot assignar' };
            }
            
            if (selectedModality && selectedModality.codi === 'casa') {
                // Modalitat casa - verificar restriccions
                const hasOtherAssignments = existingAssignments.length > 0;
                if (hasOtherAssignments) {
                    const brotherNames = existingAssignments.map(a => a.nom_germa).join(', ');
                    await this.showInfoModal(
                        'No es pot afegir',
                        `Aquest dia ja està assignat a ${brotherNames}. No es pot estar a casa si hi ha altres assignacions.`
                    );
                    return { success: false, error: 'No es pot afegir' };
                }
            }
            
            // Afegir nova assignació
            const payload = {
                date: dateKey,
                brother_id: this.selectedBrother,
                modality_id: this.selectedMode,
                action: 'add'
            };
            
            const result = await this.executeAssignmentAction(payload, 'add');
            return result;
        }
    }
    
    async executeAssignmentAction(payload, action) {
        console.log(`🔧 Executant acció: ${action} en entorn ${this.isLocalEnvironment() ? 'LOCAL' : 'REMOT'}`);
        console.log(`📋 Payload:`, payload);
        
        this.showSpinner(action === 'remove' ? 'Netejant assignació...' : 'Afegint assignació...');
        
        // Verificar connexió abans d'executar
        const isConnected = await this.checkServerConnection();
        if (!isConnected) {
            this.hideSpinner();
            await this.showInfoModal('Error de connexió', 'No es pot connectar amb el servidor. Reviseu la connexió i torneu a intentar-ho.');
            return { success: false, error: 'No connection' };
        }
        
        try {
            const method = action === 'add' ? 'POST' : 'DELETE';
            const requestUrl = '/api/v1/assignment';
            
            console.log(`📡 ${method} a ${requestUrl}`);
            
            const response = await fetch(requestUrl, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            
            console.log(`📥 Resposta del servidor:`, result);
            
            if (result.success) {
                console.log(`✅ Acció ${action} executada correctament`);
                
                // Esperar més temps per assegurar que la base de dades s'actualitzi
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Actualitzar només la cel·la específica - MÉS RÀPID
                const dateStr = payload.date;
                await this.updateSingleCell(dateStr);
                
                // Actualitzar la informació de darrera modificació
                await this.updateLastModificationInfo();
                
                // Ara sí que amaguem l'spinner després de actualitzar la cel·la
                this.hideSpinner();
                return result;
            } else {
                console.error(`❌ Error en acció ${action}:`, result.error);
                
                // En cas d'error, actualitzar la cel·la específica igualment
                const dateStr = payload.date;
                await this.updateSingleCell(dateStr);
                
                // Ara sí que amaguem l'spinner després de actualitzar la cel·la
                this.hideSpinner();
                await this.showInfoModal('Error', result.error);
                return result;
            }
        } catch (error) {
            console.error(`❌ Error de connexió en acció ${action}:`, error);
            
            // Actualitzar la cel·la específica fins i tot en cas d'error
            const dateStr = payload.date;
            await this.updateSingleCell(dateStr);
            
            // Ara sí que amaguem l'spinner després de actualitzar la cel·la
            this.hideSpinner();
            await this.showInfoModal('Error', 'Error de connexió amb el servidor');
            throw error;
        }
    }
    
    getBrotherName(brotherId) {
        const brother = this.brothers.find(b => b.id === brotherId);
        return brother ? brother.nom : 'Germà desconegut';
    }

    getDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Recàrrega RADICAL - recarregar la pàgina sencera
    async forceReloadAfterMultipleOperations() {
        console.log('🔄 Recàrrega radical - recarregant pàgina...');
        
        // Esperar un moment per assegurar-se que les operacions s'han completat
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Recarregar la pàgina sencera
        window.location.reload();
    }

    // Verificació simplificada
    async verifyAndRetryReload(cellsToProcess, actionType, maxRetries) {
        console.log('🔍 Verificació simplificada...');
        
        // Esperar un moment per assegurar-se que la base de dades s'ha actualitzat
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Recarregar una vegada més
        await this.forceReloadAfterMultipleOperations();
        
        console.log('✅ Verificació completada');
    }

    // Actualitzar només una cel·la específica del calendari
    async updateSingleCell(dateStr) {
        console.log(`🔄 Actualitzant cel·la ${dateStr}...`);
        
        // Prevenir actualitzacions concurrents de la mateixa cel·la
        if (this.updatingCells && this.updatingCells.has(dateStr)) {
            console.log(`⚠️ Cel·la ${dateStr} ja s'està actualitzant, saltant...`);
            return false;
        }
        
        if (!this.updatingCells) {
            this.updatingCells = new Set();
        }
        this.updatingCells.add(dateStr);
        
        try {
            // Recarregar dades del servidor amb màxima agressivitat anti-cache
            const timestamp = Date.now();
            const randomParam = Math.random().toString(36).substring(7);
            const cacheBreaker = `${timestamp}_${randomParam}_${dateStr}`;
            
            const response = await fetch(`${this.apiBase}?t=${cacheBreaker}&nocache=true`, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'If-Modified-Since': 'Mon, 26 Jul 1997 05:00:00 GMT',
                    'If-None-Match': '*'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Actualitzar les dades locals
                this.assignments = result.assignments || [];
                this.brothers = result.brothers || [];
                this.modalities = result.modalities || [];
                
                // Actualitzar la informació de darrera modificació si està disponible
                if (result.last_modification) {
                    this.updateLastModificationDisplay(result.last_modification);
                }
                
                // Esperar més temps per assegurar que les dades s'han processat completament
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Trobar l'element DOM de la cel·la
                const date = new Date(dateStr);
                const dayElement = document.querySelector(`[data-date="${this.getDateKey(date)}"]`);
                
                if (dayElement) {
                    // Re-renderitzar només aquesta cel·la amb neteja completa
                    this.renderSingleDay(dayElement, date);
                    console.log(`✅ Cel·la ${dateStr} actualitzada`);
                    
                    // Esperar més temps perquè el DOM es processi completament
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Verificar que la cel·la s'ha renderitzat correctament
                    const hasAssignments = this.assignments.filter(assignment => {
                        const assignmentDate = new Date(assignment.data_assignacio);
                        const checkDate = new Date(date);
                        return assignmentDate.toDateString() === checkDate.toDateString();
                    }).length > 0;
                    
                    const hasAssignmentClass = dayElement.classList.contains('has-assignment');
                    
                    if (hasAssignments && !hasAssignmentClass) {
                        console.warn(`⚠️ Cel·la ${dateStr} té assignacions però no la classe CSS. Re-renderitzant...`);
                        // Re-renderitzar una vegada més
                        await new Promise(resolve => setTimeout(resolve, 50));
                        this.renderSingleDay(dayElement, date);
                    } else if (!hasAssignments && hasAssignmentClass) {
                        console.warn(`⚠️ Cel·la ${dateStr} no té assignacions però té la classe CSS. Re-renderitzant...`);
                        // Re-renderitzar una vegada més
                        await new Promise(resolve => setTimeout(resolve, 50));
                        this.renderSingleDay(dayElement, date);
                    }
                } else {
                    console.warn(`⚠️ No s'ha trobat la cel·la ${dateStr}`);
                }
                
                return true;
            } else {
                console.error('Error del servidor:', result.error);
                return false;
            }
        } catch (error) {
            console.error(`❌ Error actualitzant cel·la ${dateStr}:`, error);
            return false;
        } finally {
            // Sempre netejar el flag d'actualització
            this.updatingCells.delete(dateStr);
        }
    }

    // Recarregar les dades del calendari per assegurar que tenim la informació més recent
    async reloadCalendarDataForCells() {
        console.log('🔄 Recarregant dades del calendari per cel·les...');
        
        // Prevenir recarregaments concurrents
        if (this.reloadingData) {
            console.log('⚠️ Ja s\'estan recarregant les dades, saltant...');
            return false;
        }
        
        this.reloadingData = true;
        
        try {
            const timestamp = Date.now();
            const randomParam = Math.random().toString(36).substring(7);
            const cacheBreaker = `${timestamp}_${randomParam}_reload`;
            
            const response = await fetch(`${this.apiBase}?t=${cacheBreaker}&nocache=true`, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'If-Modified-Since': 'Mon, 26 Jul 1997 05:00:00 GMT',
                    'If-None-Match': '*'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Verificar que les dades no són buides
                if (!result.assignments || !result.brothers || !result.modalities) {
                    throw new Error('Dades incompletes del servidor');
                }
                
                // Verificar si hi ha canvis significatius
                const oldAssignmentsCount = this.assignments.length;
                const newAssignmentsCount = result.assignments.length;
                
                if (Math.abs(oldAssignmentsCount - newAssignmentsCount) > 10) {
                    console.warn(`⚠️ Canvi significatiu en assignacions: ${oldAssignmentsCount} -> ${newAssignmentsCount}`);
                }
                
                // Actualitzar les dades locals
                this.assignments = result.assignments || [];
                this.brothers = result.brothers || [];
                this.modalities = result.modalities || [];
                
                console.log(`✅ Dades del calendari recarregades correctament: ${this.assignments.length} assignacions`);
                return true;
            } else {
                console.error('Error del servidor:', result.error);
                return false;
            }
        } catch (error) {
            console.error('❌ Error recarregant dades del calendari:', error);
            return false;
        } finally {
            this.reloadingData = false;
        }
    }

    // Re-renderitzar només una cel·la específica del calendari
    renderSingleDay(dayElement, date) {
        console.log(`🔄 Re-renderitzant cel·la per ${date.toDateString()}...`);
        
        // Eliminar TOTES les classes existents d'assignació de forma més agressiva
        dayElement.classList.remove('has-assignment', 'has-multiple-assignments');
        for (let i = 1; i <= 10; i++) { // Augmentar rang per si hi ha més germans
            dayElement.classList.remove(`brother-${i}`);
        }
        
        // Trobar el contenidor d'assignacions i netejar-lo completament
        const assignmentsContainer = dayElement.querySelector('.day-assignments');
        if (assignmentsContainer) {
            // Netejar completament el contenidor
            assignmentsContainer.innerHTML = '';
            assignmentsContainer.classList.remove('multiple-assignments');
            
            // Eliminar qualsevol atribut que pugui interferir
            assignmentsContainer.removeAttribute('style');
        }
        
        // Forçar una actualització del DOM abans de continuar
        dayElement.offsetHeight; // Trigger reflow
        
        // Mostrar assignacions existents
        const dateKey = this.getDateKey(date);
        const dayAssignments = this.assignments.filter(assignment => {
            const assignmentDate = new Date(assignment.data_assignacio);
            const checkDate = new Date(date);
            return assignmentDate.toDateString() === checkDate.toDateString();
        });
        
        if (dayAssignments.length > 0) {
            dayElement.classList.add('has-assignment');
            
            if (dayAssignments.length === 1) {
                // Una sola assignació - aplicar color del germà
                const assignment = dayAssignments[0];
                
                // Afegir classe per al color del germà
                dayElement.classList.add(`brother-${assignment.germa_id}`);
                
                const assignmentEl = document.createElement('div');
                assignmentEl.className = 'assignment';
                
                // En mòbil, mostrar nom curt
                const displayName = this.getShortName(assignment.nom_germa);
                
                assignmentEl.textContent = displayName;
                assignmentEl.title = `${assignment.nom_germa} - ${assignment.nom_modalitat}`;
                
                const modalityEl = document.createElement('div');
                modalityEl.className = 'assignment-modality';
                modalityEl.textContent = this.getShortModalityText(assignment.nom_modalitat);
                
                assignmentsContainer.appendChild(assignmentEl);
                assignmentsContainer.appendChild(modalityEl);
                
            } else {
                // Múltiples assignacions - color taronja pastel
                dayElement.classList.add('has-multiple-assignments');
                assignmentsContainer.classList.add('multiple-assignments');
                
                // Crear llista de noms dels germans
                const brotherNames = dayAssignments.map(a => a.nom_germa).join(', ');
                const modalities = [...new Set(dayAssignments.map(a => a.nom_modalitat))];
                
                // Mostrar noms dels germans
                dayAssignments.forEach(assignment => {
                    const assignmentEl = document.createElement('div');
                    assignmentEl.className = 'assignment';
                    
                    // En mòbil, mostrar nom curt
                    const displayName = this.getShortName(assignment.nom_germa);
                    
                    assignmentEl.textContent = displayName;
                    assignmentEl.title = `${assignment.nom_germa} - ${assignment.nom_modalitat}`;
                    assignmentsContainer.appendChild(assignmentEl);
                });
                
                // Mostrar modalitat comuna (assumint que tots tenen la mateixa modalitat)
                if (modalities.length === 1) {
                    const modalityEl = document.createElement('div');
                    modalityEl.className = `assignment-modality ${modalities[0].toLowerCase()}`;
                    modalityEl.textContent = this.getShortModalityText(modalities[0]);
                    assignmentsContainer.appendChild(modalityEl);
                }
            }
        }
        
        // Forçar una altra actualització del DOM després de completar la renderització
        dayElement.offsetHeight; // Trigger reflow
        
        console.log(`✅ Cel·la re-renderitzada per ${date.toDateString()}`);
    }

    hasAssignmentForDate(date) {
        const dateKey = this.getDateKey(date);
        return this.assignments.some(assignment => {
            const assignmentDate = new Date(assignment.data_assignacio);
            const assignmentKey = this.getDateKey(assignmentDate);
            return assignmentKey === dateKey;
        });
    }

    getBrotherDisplayName(brother) {
        const names = {
            'germà1': 'G1',
            'germà2': 'G2',
            'germà3': 'G3'
        };
        return names[brother] || brother;
    }

    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.renderCalendar();
        this.updateCurrentMonthDisplay();
    }

    nextMonth() {
        if (this.currentDate < this.endDate) {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.renderCalendar();
            this.updateCurrentMonthDisplay();
        }
    }

    updateCurrentMonthDisplay() {
        const monthNames = [
            'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny',
            'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'
        ];
        
        const currentMonthElement = document.getElementById('current-month');
        currentMonthElement.textContent = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
    }

    showConfirmModal(title, message, confirmButtonText = 'Sí, esborrar') {
        return new Promise((resolve) => {
            // Crear modal
            const modal = document.createElement('div');
            modal.className = 'confirm-modal';
            modal.innerHTML = `
                <div class="modal-backdrop">
                    <div class="modal-content">
                        <h3>${title}</h3>
                        <p>${message}</p>
                        <div class="modal-buttons">
                            <button class="btn-confirm">${confirmButtonText}</button>
                            <button class="btn-cancel">Cancel·lar</button>
                        </div>
                    </div>
                </div>
            `;

            // Afegir modal al DOM
            document.body.appendChild(modal);

            // Event listeners per als botons
            const confirmBtn = modal.querySelector('.btn-confirm');
            const cancelBtn = modal.querySelector('.btn-cancel');
            const backdrop = modal.querySelector('.modal-backdrop');

            const cleanup = () => {
                document.body.removeChild(modal);
            };

            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            // Tancar modal fent clic fora
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    cleanup();
                    resolve(false);
                }
            });

            // Tancar modal amb ESC
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        });
    }

    // Funcions d'utilitat per modals i spinner
    showSpinner(message = 'Processant...') {
        // Eliminar spinner existent si n'hi ha un
        this.hideSpinner();
        
        const spinner = document.createElement('div');
        spinner.className = 'spinner-overlay';
        spinner.id = 'app-spinner';
        spinner.innerHTML = `
            <div class="spinner"></div>
            <div class="spinner-text">${message}</div>
        `;
        document.body.appendChild(spinner);
        
        // Timeout de seguretat per evitar que l'spinner es quedi penjat
        if (this.spinnerTimeout) {
            clearTimeout(this.spinnerTimeout);
        }
        this.spinnerTimeout = setTimeout(() => {
            this.hideSpinner();
        }, 30000); // 30 segons màxim
    }

    hideSpinner() {
        if (this.spinnerTimeout) {
            clearTimeout(this.spinnerTimeout);
            this.spinnerTimeout = null;
        }
        
        const spinner = document.getElementById('app-spinner');
        if (spinner) {
            document.body.removeChild(spinner);
        }
    }

    showInfoModal(title, message) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'info-modal';
            modal.innerHTML = `
                <div class="info-modal-content">
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <button class="btn-ok">D'acord</button>
                </div>
            `;

            document.body.appendChild(modal);

            const okBtn = modal.querySelector('.btn-ok');
            const cleanup = () => {
                document.body.removeChild(modal);
                resolve();
            };

            okBtn.addEventListener('click', cleanup);

            // Tancar modal amb ESC
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);

            // Tancar modal fent clic fora
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    cleanup();
                    document.removeEventListener('keydown', handleEscape);
                }
            });
        });
    }

    updateLastModificationDisplay(lastModification) {
        const lastModElement = document.getElementById('last-modification-info');
        
        if (!lastModification || !lastModElement) {
            return;
        }

        try {
            // La data ja ve convertida de la base de dades en hora de Barcelona
            // No aplicar conversió de zona horària adicional
            const modDate = new Date(lastModification.data_modificacio);
            
            // Formatear directament sense conversió de zona horària
            const opcionsData = {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            };
            
            const opcionsHora = {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false // Format 24 hores
            };

            const formattedDate = modDate.toLocaleDateString('ca-ES', opcionsData);
            const formattedTime = modDate.toLocaleTimeString('ca-ES', opcionsHora);

            const modificationText = `Darrera modificació: ${lastModification.nom_germa} (${formattedDate} a les ${formattedTime})`;
            lastModElement.textContent = modificationText;
            lastModElement.style.display = 'block';
        } catch (error) {
            console.error('Error formatejant darrera modificació:', error);
            lastModElement.style.display = 'none';
        }
    }

    // Nou mètode per actualitzar només la informació de darrera modificació
    async updateLastModificationInfo() {
        try {
            console.log('🔄 Actualitzant informació de darrera modificació...');
            
            const timestamp = Date.now();
            const response = await fetch(`${this.apiBase}?t=${timestamp}`, {
                method: 'GET',
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.last_modification) {
                this.updateLastModificationDisplay(result.last_modification);
                console.log('✅ Informació de darrera modificació actualitzada');
            } else {
                console.warn('⚠️ No s\'ha pogut obtenir la informació de darrera modificació');
            }
        } catch (error) {
            console.error('❌ Error actualitzant informació de darrera modificació:', error);
        }
    }

    // Mètodes de selecció múltiple
    handleMultiSelectClick(date, dayElement, e = null) {
        // Evitar múltiples operacions ràpides
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            const dateStr = this.getDateKey(date);
            
            if (this.selectedCells.has(dateStr)) {
                // Si ja està seleccionada, la desseleccionem
                this.selectedCells.delete(dateStr);
                dayElement.classList.remove('selected');
            } else {
                // Sempre permetre seleccionar dies per assignar
                this.selectedCells.add(dateStr);
                dayElement.classList.add('selected');
            }
            
            this.updateSelectionCounter();
            this.updateButtonVisibility();
        }, 50); // Debounce de 50ms
    }

    clearSelection() {
        this.selectedCells.clear();
        // Eliminar classes de selecció de tots els dies
        document.querySelectorAll('.calendar-day.selected').forEach(cell => {
            cell.classList.remove('selected');
        });
        
        this.updateSelectionCounter();
        this.updateButtonVisibility();
    }

    updateSelectionCounter() {
        const counter = document.getElementById('selection-counter');
        if (counter) {
            if (this.selectedCells.size > 0) {
                counter.textContent = `${this.selectedCells.size} dies seleccionats`;
                counter.style.display = 'inline';
            } else {
                counter.style.display = 'none';
            }
        }
        
        // Actualitzar text del botó d'assignació basant-se en l'estat de les cel·les
        const assignBtn = document.getElementById('assign-selected');
        if (this.selectedCells.size > 0 && this.selectedBrother) {
            const brotherName = this.brothers.find(b => b.id === this.selectedBrother)?.nom || 'Germà';
            
            // Verificar l'estat de les cel·les seleccionades
            const validation = this.validateSelectedCells();
            
            if (validation.isValid) {
                if (validation.allEmpty) {
                    assignBtn.textContent = `Assignar a ${brotherName}`;
                } else if (validation.hasCurrentBrother) {
                    assignBtn.textContent = `Eliminar de ${brotherName}`;
                } else if (validation.canAssign) {
                    assignBtn.textContent = `Assignar a ${brotherName}`;
                } else {
                    assignBtn.textContent = `Selecció no vàlida`;
                }
            } else {
                assignBtn.textContent = `Selecció no vàlida`;
            }
        } else {
            assignBtn.textContent = 'Assignar seleccionats';
        }
    }

    updateButtonVisibility() {
        const assignBtn = document.getElementById('assign-selected');
        const clearBtn = document.getElementById('clear-selection');
        const clearAssignedBtn = document.getElementById('clear-assigned');
        
        if (this.selectedCells.size === 0) {
            // Sense dies seleccionats
            assignBtn.style.display = 'none';
            clearBtn.style.display = 'none';
            if (clearAssignedBtn) clearAssignedBtn.style.display = 'none';
        } else {
            // Dies seleccionats - mostrar botons
            assignBtn.style.display = 'inline-block';
            clearBtn.style.display = 'inline-block';
            if (clearAssignedBtn) clearAssignedBtn.style.display = 'none';
            
            // Verificar si la selecció és vàlida per habilitar/deshabilitar el botó
            const validation = this.validateSelectedCells();
            if (validation.isValid) {
                assignBtn.disabled = false;
                assignBtn.style.opacity = '1';
                
                // Actualitzar el text del botó segons l'acció
                if (validation.actionType === 'assign') {
                    const daysToAssign = this.getDaysToAssign();
                    if (daysToAssign === this.selectedCells.size) {
                        assignBtn.textContent = 'Assignar';
                    } else {
                        assignBtn.textContent = `Assignar (${daysToAssign})`;
                    }
                } else if (validation.actionType === 'remove') {
                    const daysToRemove = this.getDaysToRemove();
                    assignBtn.textContent = `Eliminar (${daysToRemove})`;
                }
            } else {
                assignBtn.disabled = true;
                assignBtn.style.opacity = '0.5';
                assignBtn.textContent = 'Assignar';
            }
        }
    }

    async assignSelectedCells() {
        if (this.selectedCells.size === 0) {
            await this.showInfoModal('Error', 'No hi ha dies seleccionats');
            return;
        }

        // Prevenir múltiples operacions simultànies
        if (this.processingMultipleAssignments) {
            console.warn('⚠️ Ja s\'està processant una assignació múltiple');
            return;
        }
        
        this.processingMultipleAssignments = true;

        try {
            // Verificar que totes les cel·les seleccionades tinguin el mateix estat
            const validationResult = this.validateSelectedCells();
            if (!validationResult.isValid) {
                await this.showInfoModal('Selecció no vàlida', validationResult.message);
                return;
            }

            const brotherName = this.brothers.find(b => b.id === this.selectedBrother)?.nom || 'Desconegut';
            const modalityName = this.modalities.find(m => m.id === this.selectedMode)?.nom || 'Desconegut';
            
            let confirmMessage;
            const actionType = validationResult.actionType;
            
            if (actionType === 'assign') {
                // Obtenir el nombre de dies que realment s'assignaran
                const daysToAssign = this.getDaysToAssign();
                confirmMessage = `Vols assignar ${daysToAssign} dies a ${brotherName} (${modalityName})?`;
            } else if (actionType === 'remove') {
                // Obtenir el nombre de dies que realment s'eliminaran
                const daysToRemove = this.getDaysToRemove();
                confirmMessage = `Vols eliminar l'assignació de ${brotherName} de ${daysToRemove} dies?`;
            } else {
                await this.showInfoModal('Selecció no vàlida', validationResult.message);
                return;
            }
            
            const confirmed = await this.showConfirmModal('Confirmar acció', confirmMessage, actionType === 'assign' ? 'Sí, assignar' : 'Sí, eliminar');
            if (!confirmed) return;

            this.showSpinner(actionType === 'assign' ? 'Assignant dies...' : 'Eliminant assignacions...');
            
            let successCount = 0;
            let errorCount = 0;
            
            // Crear una còpia del conjunt de cel·les seleccionades per evitar modificacions
            const cellsToProcess = Array.from(this.selectedCells);
            console.log(`🔄 Processant ${cellsToProcess.length} cel·les seleccionades`);
            
            // Processar dies un per un, però només els que realment necessiten canvis
            for (const dateStr of cellsToProcess) {
                try {
                    console.log(`🔄 Processant ${dateStr} (${successCount + errorCount + 1}/${cellsToProcess.length})`);
                    
                    let operationPerformed = false;
                    
                    if (actionType === 'assign') {
                        // Només assignar si el dia no té ja el germà actual
                        if (!this.dayHasCurrentBrother(dateStr)) {
                            const result = await this.assignDate(dateStr, this.selectedBrother, this.selectedMode);
                            console.log(`✅ Assignació exitosa per ${dateStr}:`, result);
                            successCount++;
                            operationPerformed = true;
                        } else {
                            console.log(`⚠️ Ja assignat per ${dateStr}`);
                        }
                    } else if (actionType === 'remove') {
                        // Només eliminar si el dia té el germà actual
                        if (this.dayHasCurrentBrother(dateStr)) {
                            const result = await this.removeAssignmentForDate(dateStr, this.selectedBrother);
                            console.log(`✅ Eliminació exitosa per ${dateStr}:`, result);
                            successCount++;
                            operationPerformed = true;
                        } else {
                            console.log(`⚠️ Ja eliminat per ${dateStr}`);
                        }
                    }
                    
                    // Actualitzar SEMPRE la cel·la individual després de processar-la
                    // (tant si s'ha fet una operació com si no)
                    await this.updateSingleCell(dateStr);
                    console.log(`🔄 Cel·la ${dateStr} actualitzada`);
                    
                    // Petit delay per assegurar que cada actualització es processi correctament
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (error) {
                    console.error(`❌ Error processant ${dateStr}:`, error);
                    errorCount++;
                    // Actualitzar la cel·la fins i tot en cas d'error
                    try {
                        await this.updateSingleCell(dateStr);
                        console.log(`🔄 Cel·la ${dateStr} actualitzada després d'error`);
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (updateError) {
                        console.error(`❌ Error actualitzant cel·la ${dateStr}:`, updateError);
                    }
                }
            }
            
            console.log(`📊 Resum: ${successCount} èxits, ${errorCount} errors`);
            
            // Actualització final de totes les cel·les processades per assegurar sincronització
            console.log('🔄 Actualització final de totes les cel·les processades...');
            
            // Primer, recarregar les dades del servidor una vegada per assegurar que tenim la info més recent
            await this.reloadCalendarDataForCells();
            
            // Esperar un moment per assegurar que les dades s'han actualitzat completament
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Després, actualitzar totes les cel·les una per una amb delay més llarg
            for (const dateStr of cellsToProcess) {
                try {
                    await this.updateSingleCell(dateStr);
                    console.log(`✅ Actualització final de ${dateStr} completada`);
                    // Delay més llarg per assegurar que cada actualització es processi completament
                    await new Promise(resolve => setTimeout(resolve, 150));
                } catch (error) {
                    console.error(`❌ Error en actualització final de ${dateStr}:`, error);
                }
            }
            
            // Tercera passada: forçar re-renderització de totes les cel·les visibles
            console.log('🔄 Tercera passada: forçant re-renderització de totes les cel·les visibles...');
            await new Promise(resolve => setTimeout(resolve, 100));
            
            for (const dateStr of cellsToProcess) {
                try {
                    const date = new Date(dateStr);
                    const dayElement = document.querySelector(`[data-date="${this.getDateKey(date)}"]`);
                    
                    if (dayElement) {
                        // Forçar re-renderització completa eliminant tots els elements
                        const assignmentsContainer = dayElement.querySelector('.day-assignments');
                        if (assignmentsContainer) {
                            assignmentsContainer.innerHTML = '';
                        }
                        
                        // Eliminar totes les classes d'assignació
                        dayElement.classList.remove('has-assignment', 'has-multiple-assignments');
                        for (let i = 1; i <= 5; i++) {
                            dayElement.classList.remove(`brother-${i}`);
                        }
                        
                        // Re-renderitzar la cel·la
                        this.renderSingleDay(dayElement, date);
                        console.log(`✅ Re-renderització forçada de ${dateStr} completada`);
                    }
                } catch (error) {
                    console.error(`❌ Error en re-renderització forçada de ${dateStr}:`, error);
                }
            }
            
            // Quarta passada: verificació final i espera abans de treure l'spinner
            console.log('🔄 Quarta passada: verificació final abans de treure spinner...');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Verificar que totes les cel·les estan en l'estat correcte
            let inconsistentCells = 0;
            for (const dateStr of cellsToProcess) {
                try {
                    const date = new Date(dateStr);
                    const dayElement = document.querySelector(`[data-date="${this.getDateKey(date)}"]`);
                    
                    if (dayElement) {
                        // Verificar estat de la cel·la
                        const hasAssignments = this.assignments.filter(assignment => {
                            const assignmentDate = new Date(assignment.data_assignacio);
                            const checkDate = new Date(date);
                            return assignmentDate.toDateString() === checkDate.toDateString();
                        }).length > 0;
                        
                        const hasAssignmentClass = dayElement.classList.contains('has-assignment');
                        
                        if (hasAssignments !== hasAssignmentClass) {
                            console.warn(`⚠️ Inconsistència detectada en ${dateStr}. Re-renderitzant...`);
                            this.renderSingleDay(dayElement, date);
                            inconsistentCells++;
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }
                } catch (error) {
                    console.error(`❌ Error en verificació final de ${dateStr}:`, error);
                }
            }
            
            if (inconsistentCells > 0) {
                console.log(`🔄 Corregides ${inconsistentCells} cel·les inconsistents`);
                // Esperar una mica més després de les correccions
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Netejar selecció
            this.clearSelection();
            
            // Ara sí que podem amagar l'spinner de forma segura
            this.hideSpinner();
            
            if (errorCount === 0) {
                const actionText = actionType === 'assign' ? 'assignat' : 'eliminat';
                await this.showInfoModal('Fet!', `S'han ${actionText} ${successCount} dies correctament`);
            } else {
                const actionText = actionType === 'assign' ? 'Assignació' : 'Eliminació';
                await this.showInfoModal(`${actionText} parcial`, `S'han processat ${successCount} dies. ${errorCount} han fallat.`);
            }
        } catch (error) {
            console.error('Error processant dies:', error);
            this.hideSpinner(); // Amagar spinner abans de mostrar error modal
            await this.showInfoModal('Error', 'Error processant algunes dies');
        } finally {
            // Sempre netejar el flag de processament
            this.processingMultipleAssignments = false;
        }
    }

    // Funcions auxiliars per a la validació
    dayHasCurrentBrother(dateStr) {
        const date = new Date(dateStr);
        const dayAssignments = this.assignments.filter(assignment => {
            const assignmentDate = new Date(assignment.data_assignacio);
            return assignmentDate.toDateString() === date.toDateString();
        });
        return dayAssignments.some(a => parseInt(a.germa_id) === parseInt(this.selectedBrother));
    }

    getDaysToAssign() {
        return Array.from(this.selectedCells).filter(dateStr => !this.dayHasCurrentBrother(dateStr)).length;
    }

    getDaysToRemove() {
        return Array.from(this.selectedCells).filter(dateStr => this.dayHasCurrentBrother(dateStr)).length;
    }

    async assignDate(dateStr, brotherId, modalityId) {
        console.log(`Assignant ${dateStr} a germà ${brotherId} amb modalitat ${modalityId}`);
        
        const payload = {
            date: dateStr,
            brother_id: brotherId,
            modality_id: modalityId,
            action: 'add'
        };
        
        const result = await this.executeAssignmentActionNoReload(payload, 'add');
        console.log(`Resultat per ${dateStr}:`, result);
        return result;
    }

    async executeAssignmentActionNoReload(payload, action) {
        try {
            const method = action === 'add' ? 'POST' : 'DELETE';
            const response = await fetch('/api/v1/assignment', {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            console.log(`Resposta del servidor per ${action}:`, result);
            
            if (result.success) {
                console.log(`${action} exitós`);
                return result;
            } else {
                console.error(`Error en ${action}:`, result.error);
                return result;
            }
        } catch (error) {
            console.error(`Error de xarxa en ${action}:`, error);
            return { success: false, error: error.message };
        }
    }

    async clearAssignedCells() {
        if (this.selectedCells.size === 0) {
            await this.showInfoModal('Error', 'No hi ha dies seleccionats');
            return;
        }

        const confirmed = await this.showConfirmModal(
            'Confirmar neteja',
            `Vols esborrar ${this.selectedCells.size} dies assignats?`,
            'Sí, esborrar'
        );

        if (!confirmed) return;

        this.showSpinner('Esborrant assignacions...');
        try {
            const cellsCount = this.selectedCells.size;
            let successCount = 0;
            let errorCount = 0;
            
            // Crear una còpia del conjunt de cel·les seleccionades
            const cellsToProcess = Array.from(this.selectedCells);
            
            // Processar dies un per un per evitar sobrecarregar el servidor
            for (const dateStr of cellsToProcess) {
                try {
                    await this.removeAssignment(dateStr);
                    successCount++;
                } catch (error) {
                    console.error(`Error esborrant ${dateStr}:`, error);
                    errorCount++;
                }
            }
            
            this.clearSelection();
            
            // Recarregar de forma senzilla
            await this.forceReloadAfterMultipleOperations();
            
            this.hideSpinner(); // Amagar spinner abans de mostrar modal
            
            if (errorCount === 0) {
                await this.showInfoModal('Fet!', `S'han esborrat ${successCount} dies correctament`);
            } else {
                await this.showInfoModal('Esborrat parcial', `S'han esborrat ${successCount} dies. ${errorCount} han fallat.`);
            }
        } catch (error) {
            console.error('Error esborrant assignacions:', error);
            this.hideSpinner(); // Amagar spinner abans de mostrar error modal
            await this.showInfoModal('Error', 'Error esborrant algunes assignacions');
        }
    }

    async removeAssignment(dateStr) {
        const payload = {
            date: dateStr,
            action: 'remove'
        };
        
        const result = await this.executeAssignmentAction(payload, 'remove');
        return result;
    }

    async removeAssignmentForDate(dateStr, brotherId) {
        console.log(`Eliminant assignació ${dateStr} del germà ${brotherId}`);
        
        // Buscar l'assignació existent per obtenir la modalitat
        const existingAssignment = this.assignments.find(assignment => {
            const assignmentDate = new Date(assignment.data_assignacio);
            const assignmentKey = this.getDateKey(assignmentDate);
            return assignmentKey === dateStr && 
                   parseInt(assignment.germa_id) === parseInt(brotherId);
        });
        
        if (!existingAssignment) {
            console.log(`Assignacions disponibles per ${dateStr}:`, this.assignments.filter(a => {
                const assignmentDate = new Date(a.data_assignacio);
                const assignmentKey = this.getDateKey(assignmentDate);
                return assignmentKey === dateStr;
            }));
            throw new Error(`No s'ha trobat assignació per ${dateStr} del germà ${brotherId}`);
        }
        
        console.log(`Assignació trobada:`, existingAssignment);
        
        const payload = {
            date: dateStr,
            brother_id: brotherId,
            modality_id: existingAssignment.modalitat_id,
            action: 'remove'
        };
        
        const result = await this.executeAssignmentActionNoReload(payload, 'remove');
        return result;
    }

    validateSelectedCells() {
        const selectedDates = Array.from(this.selectedCells);
        
        // Obtenir assignacions per a cada data seleccionada
        const cellStates = selectedDates.map(dateStr => {
            const date = new Date(dateStr);
            const dayAssignments = this.assignments.filter(assignment => {
                const assignmentDate = new Date(assignment.data_assignacio);
                return assignmentDate.toDateString() === date.toDateString();
            });
            
            return {
                date: dateStr,
                assignments: dayAssignments,
                isEmpty: dayAssignments.length === 0,
                hasCurrentBrother: dayAssignments.some(a => parseInt(a.germa_id) === parseInt(this.selectedBrother)),
                hasCasaAssignment: dayAssignments.some(a => a.modality_code === 'casa')
            };
        });
        
        // Verificar si tots els dies estan buits
        const allEmpty = cellStates.every(state => state.isEmpty);
        
        if (allEmpty) {
            return {
                isValid: true,
                allEmpty: true,
                hasCurrentBrother: false,
                canAssign: true,
                actionType: 'assign',
                message: 'Tots els dies estan buits - assignar'
            };
        }
        
        // Verificar si hi ha dies amb assignacions "A casa"
        const daysWithCasa = cellStates.filter(state => state.hasCasaAssignment);
        if (daysWithCasa.length > 0) {
            return {
                isValid: false,
                allEmpty: false,
                hasCurrentBrother: false,
                canAssign: false,
                actionType: 'none',
                message: 'No es pot assignar res més quan hi ha algú a casa'
            };
        }
        
        // Verificar l'estat del germà actual en els dies seleccionats
        const daysWithCurrentBrother = cellStates.filter(state => state.hasCurrentBrother);
        const daysWithoutCurrentBrother = cellStates.filter(state => !state.hasCurrentBrother);
        
        if (daysWithCurrentBrother.length === cellStates.length) {
            // Tots els dies tenen el germà actual assignat - eliminar
            return {
                isValid: true,
                allEmpty: false,
                hasCurrentBrother: true,
                canAssign: false,
                actionType: 'remove',
                message: 'Tots els dies tenen el germà actual assignat - eliminar'
            };
        } else if (daysWithoutCurrentBrother.length === cellStates.length) {
            // Cap dia té el germà actual assignat - assignar
            return {
                isValid: true,
                allEmpty: false,
                hasCurrentBrother: false,
                canAssign: true,
                actionType: 'assign',
                message: 'Cap dia té el germà actual assignat - assignar'
            };
        } else {
            // Selecció mixta - sempre assignar als dies que no tenen el germà actual
            return {
                isValid: true,
                allEmpty: false,
                hasCurrentBrother: false,
                canAssign: true,
                actionType: 'assign',
                message: `Assignar als ${daysWithoutCurrentBrother.length} dies que no tenen el germà actual`
            };
        }
    }
}

// Inicialitzar l'aplicació quan es carregui la pàgina
document.addEventListener('DOMContentLoaded', () => {
    new CalendarApp();
});
