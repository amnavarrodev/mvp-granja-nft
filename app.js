// ============================================
// CONFIGURACIÓN DEL JUEGO (cargada desde data.json)
// ============================================
let CONFIG = {
    gallinero: { maxGallinas: 5, precio: 100 },
    gallina: { precio: 50, produccionHuevosPorHora: 1, consumoAlimentoPorHora: 1, consumoAguaPorHora: 1 },
    alimento: { precio: 5 },
    agua: { precio: 3 },
    incubacion: { huevosRequeridos: 3, tiempoMinutos: 5 },
    mercado: { comision: 0.05 }
};

// ============================================
// ESTADO DEL JUGADOR (localStorage para MVP)
// ============================================
const ESTADO_INICIAL = {
    tokens: 500,
    huevos: 0,
    alimento: 10,
    agua: 10,
    gallinas: [],
    gallinero: null,
    incubaciones: [],
    ultimaActualizacion: Date.now(),
    accionesHoy: { alimentar: false, agua: false, limpiar: false }
};

let estado = { ...ESTADO_INICIAL };

// Cargar estado guardado
function cargarEstado() {
    const guardado = localStorage.getItem('granja_estado');
    if (guardado) {
        try {
            const parsed = JSON.parse(guardado);
            estado = { ...ESTADO_INICIAL, ...parsed };
        } catch (e) {
            console.warn('Error cargando estado, usando inicial');
        }
    }
}

function guardarEstado() {
    estado.ultimaActualizacion = Date.now();
    localStorage.setItem('granja_estado', JSON.stringify(estado));
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    cargarEstado();
    
    // Inicializar Telegram WebApp
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    }

    // Cargar data.json (opcional, para configuración externa)
    fetch('data.json')
        .then(res => res.json())
        .then(data => { CONFIG = { ...CONFIG, ...data }; })
        .catch(() => console.log('Usando configuración por defecto'));

    renderizarTodo();
    configurarEventos();
    
    // Tick cada segundo para actualizar producción
    setInterval(tick, 1000);
});

// ============================================
// LÓGICA DEL JUEGO
// ============================================

function tick() {
    // Actualizar producción de huevos (simplificado para MVP)
    // En producción real, esto se haría con timestamps y cálculos de tiempo transcurrido
    
    // Actualizar incubaciones
    const ahora = Date.now();
    estado.incubaciones = estado.incubaciones.filter(inc => {
        if (ahora >= inc.fin) {
            // Nace una gallina nueva
            agregarGallina();
            toast('🐣 ¡Ha nacido una gallina nueva!');
            return false;
        }
        return true;
    });

    renderizarTodo();
    guardarEstado();
}

function agregarGallina() {
    if (!estado.gallinero) return;
    if (estado.gallinas.length >= CONFIG.gallinero.maxGallinas) return;
    
    const nuevaGallina = {
        id: Date.now() + Math.random(),
        estado: 'feliz', // feliz, hambrienta, lista
        huevosListos: 0,
        ultimaProduccion: Date.now()
    };
    estado.gallinas.push(nuevaGallina);
}

function recogerHuevos() {
    let total = 0;
    estado.gallinas.forEach(g => {
        if (g.estado === 'lista') {
            total += g.huevosListos;
            g.huevosListos = 0;
            g.estado = 'feliz';
        }
    });
    
    if (total > 0) {
        estado.huevos += total;
        toast(`🥚 +${total} huevos recogidos`);
        guardarEstado();
        renderizarTodo();
    }
}

function comprarItem(tipo) {
    // MVP: simplificado
    if (tipo === 'gallinero') {
        if (estado.tokens < CONFIG.gallinero.precio) {
            toast('❌ Tokens insuficientes', true);
            return;
        }
        estado.tokens -= CONFIG.gallinero.precio;
        estado.gallinero = { nivel: 1, limpieza: 100 };
        toast('🏠 ¡Gallinero comprado!');
    } else if (tipo === 'gallina') {
        if (!estado.gallinero) {
            toast('❌ Primero compra un gallinero', true);
            return;
        }
        if (estado.gallinas.length >= CONFIG.gallinero.maxGallinas) {
            toast('❌ Gallinero lleno', true);
            return;
        }
        if (estado.tokens < CONFIG.gallina.precio) {
            toast('❌ Tokens insuficientes', true);
            return;
        }
        estado.tokens -= CONFIG.gallina.precio;
        agregarGallina();
        toast('🐔 ¡Gallina comprada!');
    } else if (tipo === 'alimento') {
        if (estado.tokens < CONFIG.alimento.precio) {
            toast('❌ Tokens insuficientes', true);
            return;
        }
        estado.tokens -= CONFIG.alimento.precio;
        estado.alimento += 10;
        toast('🌾 +10 alimento');
    } else if (tipo === 'agua') {
        if (estado.tokens < CONFIG.agua.precio) {
            toast('❌ Tokens insuficientes', true);
            return;
        }
        estado.tokens -= CONFIG.agua.precio;
        estado.agua += 10;
        toast('💧 +10 agua');
    }
    
    guardarEstado();
    renderizarTodo();
}

function incubarHuevo() {
    if (estado.huevos < CONFIG.incubacion.huevosRequeridos) {
        toast('❌ Huevos insuficientes', true);
        return;
    }
    if (!estado.gallinero) {
        toast('❌ Primero compra un gallinero', true);
        return;
    }
    if (estado.gallinas.length >= CONFIG.gallinero.maxGallinas) {
        toast('❌ Gallinero lleno', true);
        return;
    }
    if (estado.incubaciones.length >= 3) {
        toast('❌ Incubadora llena', true);
        return;
    }

    estado.huevos -= CONFIG.incubacion.huevosRequeridos;
    estado.incubaciones.push({
        fin: Date.now() + (CONFIG.incubacion.tiempoMinutos * 60 * 1000)
    });
    toast('🥚 Incubación iniciada');
    guardarEstado();
    renderizarTodo();
}

// ============================================
// RENDERIZADO
// ============================================

function renderizarTodo() {
    renderizarRecursos();
    renderizarGranja();
    renderizarMercado();
    renderizarIncubadora();
}

function renderizarRecursos() {
    document.getElementById('token-balance').textContent = Math.floor(estado.tokens);
    document.getElementById('egg-balance').textContent = estado.huevos;
    document.getElementById('feed-balance').textContent = estado.alimento;
}

function renderizarGranja() {
    // Actualizar contador de gallinas
    document.getElementById('chicken-count').textContent = 
        `${estado.gallinas.length}/${CONFIG.gallinero.maxGallinas} gallinas`;

    // Renderizar gallinero visual
    const coopVisual = document.getElementById('coop-visual');
    if (estado.gallinero) {
        coopVisual.innerHTML = `
            <div class="coop-placeholder">
                <span class="coop-icon">🏠</span>
                <p>Gallinero Nivel ${estado.gallinero.nivel}</p>
            </div>
        `;
    }

    // Renderizar gallinas
    const grid = document.getElementById('chicken-grid');
    grid.innerHTML = '';
    estado.gallinas.forEach((g, i) => {
        const card = document.createElement('div');
        card.className = `chicken-card ${g.estado === 'lista' ? 'ready' : g.estado === 'hambrienta' ? 'hungry' : 'happy'}`;
        card.innerHTML = `
            <span class="chicken-emoji">🐔</span>
            <div class="chicken-stats">${g.huevosListos} 🥚</div>
        `;
        grid.appendChild(card);
    });

    // Habilitar/deshabilitar botones
    const hayGallinas = estado.gallinas.length > 0;
    document.getElementById('btn-feed').disabled = !hayGallinas || estado.alimento <= 0;
    document.getElementById('btn-water').disabled = !hayGallinas || estado.agua <= 0;
    document.getElementById('btn-clean').disabled = !estado.gallinero;

    // Botón de recoger
    const huevosListos = estado.gallinas.reduce((sum, g) => sum + g.huevosListos, 0);
    document.getElementById('pending-eggs').textContent = huevosListos;
    document.getElementById('btn-collect').disabled = huevosListos === 0;
}

function renderizarMercado() {
    const grid = document.getElementById('market-grid');
    grid.innerHTML = '';

    const items = [
        { tipo: 'gallinero', icon: '🏠', nombre: 'Gallinero', desc: 'Alberga hasta 5 gallinas', precio: CONFIG.gallinero.precio, disabled: !!estado.gallinero },
        { tipo: 'gallina', icon: '🐔', nombre: 'Gallina', desc: 'Produce huevos', precio: CONFIG.gallina.precio, disabled: !estado.gallinero || estado.gallinas.length >= CONFIG.gallinero.maxGallinas },
        { tipo: 'alimento', icon: '🌾', nombre: 'Alimento x10', desc: 'Para alimentar gallinas', precio: CONFIG.alimento.precio, disabled: false },
        { tipo: 'agua', icon: '💧', nombre: 'Agua x10', desc: 'Para dar de beber', precio: CONFIG.agua.precio, disabled: false },
    ];

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'market-item';
        el.innerHTML = `
            <div class="market-item-info">
                <span class="market-item-icon">${item.icon}</span>
                <div>
                    <div class="market-item-name">${item.nombre}</div>
                    <div class="market-item-desc">${item.desc}</div>
                </div>
            </div>
            <button class="buy-btn" data-tipo="${item.tipo}" ${item.disabled ? 'disabled' : ''}>
                Comprar
                <span class="price">${item.precio} 🪙</span>
            </button>
        `;
        grid.appendChild(el);
    });

    // Eventos de compra
    grid.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', () => comprarItem(btn.dataset.tipo));
    });
}

function renderizarIncubadora() {
    const container = document.getElementById('incubator-slots');
    container.innerHTML = '';

    for (let i = 0; i < 3; i++) {
        const inc = estado.incubaciones[i];
        const slot = document.createElement('div');
        slot.className = `slot ${inc ? 'active' : ''}`;
        
        if (inc) {
            const restante = Math.max(0, Math.ceil((inc.fin - Date.now()) / 60000));
            slot.innerHTML = `
                <span class="slot-emoji">🥚</span>
                <span class="slot-timer">${restante} min</span>
            `;
        } else {
            slot.innerHTML = `<span class="slot-emoji">➕</span>`;
        }
        container.appendChild(slot);
    }

    // Botón incubar
    const btn = document.getElementById('btn-incubate');
    btn.disabled = estado.huevos < CONFIG.incubacion.huevosRequeridos || 
                   estado.incubaciones.length >= 3 ||
                   !estado.gallinero ||
                   estado.gallinas.length >= CONFIG.gallinero.maxGallinas;
    
    btn.textContent = `🥚 Incubar (${CONFIG.incubacion.huevosRequeridos} huevos)`;
}

// ============================================
// EVENTOS
// ============================================

function configurarEventos() {
    // Navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
        });
    });

    // Botones de acción
    document.getElementById('btn-feed').addEventListener('click', () => {
        if (estado.alimento > 0) {
            estado.alimento--;
            estado.gallinas.forEach(g => g.estado = 'feliz');
            toast('🌾 Gallinas alimentadas');
            guardarEstado();
            renderizarTodo();
        }
    });

    document.getElementById('btn-water').addEventListener('click', () => {
        if (estado.agua > 0) {
            estado.agua--;
            toast('💧 Gallinas hidratadas');
            guardarEstado();
            renderizarTodo();
        }
    });

    document.getElementById('btn-clean').addEventListener('click', () => {
        if (estado.gallinero) {
            toast('🧹 Gallinero limpio');
            guardarEstado();
        }
    });

    document.getElementById('btn-collect').addEventListener('click', recogerHuevos);
    document.getElementById('btn-incubate').addEventListener('click', incubarHuevo);
}

// ============================================
// UTILIDADES
// ============================================

function toast(mensaje, esError = false) {
    // Eliminar toast existente
    document.querySelector('.toast')?.remove();
    
    const el = document.createElement('div');
    el.className = `toast ${esError ? 'error' : ''}`;
    el.textContent = mensaje;
    document.body.appendChild(el);
    
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, 2000);
}

// ============================================
// SIMULACIÓN DE PRODUCCIÓN (para MVP)
// ============================================
// Cada 10 segundos, las gallinas producen huevos
setInterval(() => {
    if (estado.gallinas.length === 0) return;
    
    estado.gallinas.forEach(g => {
        if (g.estado === 'feliz') {
            g.huevosListos = Math.min(g.huevosListos + 1, 5);
            if (g.huevosListos >= 5) {
                g.estado = 'lista';
            }
        }
    });
    
    renderizarGranja();
}, 10000);