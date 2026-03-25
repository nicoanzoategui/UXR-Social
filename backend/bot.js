const fs = require('fs');
const path = require('path');
const { Builder, By, until, Key } = require('selenium-webdriver');

// ─── Config: selectores (si Google los cambia, solo actualizá esto) ───
const SELECTORS = {
    searchBox: 'q',
    tabReseñas: "//button[contains(., 'Reseñas')] | //span[contains(text(), 'Reseñas')]/ancestor::button | //button[contains(., 'Reviews')] | //span[contains(text(), 'Reviews')]/ancestor::button",
    contenedorListaReseñas: 'div.m6QErb',
    botonVerMas: 'button[aria-label="Ver más"]',
    reviewBlock: 'div[data-irrelevant-review-text-id]',
    rating: 'span[role="img"][aria-label*="estrella"]',
    date: 'span.rsqaWe',
    reviewText: 'div.MyEned span.wiI7pd',
    ownerReply: 'div.CDe7pd',
    ownerReplyText: 'div.CDe7pd div.wiI7pd',
};

const XP_ABRIR_BUSCADOR_RESEÑAS =
    "(.//*[normalize-space(text()) and normalize-space(.)='Escribir una reseña'])[1]/following::span[2]";
const XP_CERRAR_BUSCADOR_RESEÑAS =
    "(.//*[normalize-space(text()) and normalize-space(.)='Escribir una reseña'])[1]/following::span[3]";

const PAUSA_DESPUES_VER_MAS_MS = 250;
const META_RESEÑAS = Math.max(1, parseInt(process.env.META_RESENAS || process.env.META_RESEÑAS || '50', 10));
const FLECHAS_ABAJO = parseInt(process.env.FLECHAS_ABAJO || '10000', 10);
const PAUSA_ENTRE_TANDAS_SEC = parseInt(process.env.PAUSA_ENTRE_TANDAS_SEC || '2', 10);
const MAX_TANDAS = parseInt(process.env.MAX_TANDAS || '25', 10);

async function clicAbrirCerrarBuscador(driver) {
    try {
        const abrir = await driver.wait(until.elementLocated(By.xpath(XP_ABRIR_BUSCADOR_RESEÑAS)), 5000);
        await abrir.click();
        await driver.sleep(400);
        const cerrar = await driver.wait(until.elementLocated(By.xpath(XP_CERRAR_BUSCADOR_RESEÑAS)), 3000);
        await cerrar.click();
        await driver.sleep(400);
    } catch (e) {
        console.warn('Advertencia: No se pudo cliclear abrir/cerrar buscador:', e.message);
    }
}

async function enviarFlechasAbajo(driver, total) {
    for (let i = 0; i < total; i++) {
        await driver.actions().sendKeys(Key.ARROW_DOWN).perform();
    }
}

async function handleConsent(driver) {
    const consentSelectors = [
        "//button[contains(., 'Aceptar todo')]",
        "//button[contains(., 'Accept all')]",
        "//button[contains(., 'Agree')]",
        "//form//button[contains(., 'Aceptar')]",
        "//form//button[contains(., 'Accept')]"
    ];
    for (const sel of consentSelectors) {
        try {
            const btn = await driver.findElement(By.xpath(sel));
            if (btn) {
                await btn.click();
                await driver.sleep(1000);
                return;
            }
        } catch (_) { }
    }
}

(async function openGoogleMaps() {
    const url = process.argv[2];
    if (!url) {
        console.error('Error: se debe pasar la URL de Google Maps como argumento. Ej: node bot.js "https://maps.google.com/..."');
        process.exit(1);
    }

    const chrome = require('selenium-webdriver/chrome');
    let options = new chrome.Options();
    options.addArguments('--headless=new');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--lang=es');
    options.addArguments('--disable-blink-features=AutomationControlled');

    let driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
    try {
        await driver.get(url);
        await driver.sleep(4000);

        await handleConsent(driver);
        await driver.sleep(1500);

        // Esperar a que el panel del lugar esté cargado (botón Indicaciones es buen indicador)
        try {
            await driver.wait(until.elementLocated(By.xpath("//button[contains(@aria-label,'Indicaciones') or contains(@aria-label,'Directions')]")), 8000);
            console.log('Panel del lugar cargado.');
            await driver.sleep(2000);
        } catch (_) {
            console.warn('Advertencia: no se detectó panel del lugar, continuando de todas formas.');
        }

        // Intentar detectar si las reseñas ya están visibles (por si la URL ya apunta ahí)
        let bloquesIniciales = await driver.findElements(By.css(SELECTORS.reviewBlock));
        if (bloquesIniciales.length === 0) {
            console.log('Reseñas no visibles al inicio, buscando pestaña...');
            // Intentar varios selectores para la pestaña de reseñas
            const selectorsReseñas = [
                "//button[contains(@aria-label, 'Reseñas')]",
                "//button[contains(@aria-label, 'Reviews')]",
                "//button[contains(., 'Reseñas')]",
                "//button[contains(., 'Reviews')]",
                "//span[contains(text(), 'Reseñas')]/ancestor::button",
                "//span[contains(text(), 'Reviews')]/ancestor::button",
                "//div[@role='tablist']//button[2]",
                "//div[@role='tablist']//button",
                // Selector por jslog: el botón de Reviews suele tener jslog con 120706
                "//button[@jslog and .//span[contains(.,'Reseña')]]",
                "//button[@jslog and .//span[contains(.,'Review')]]",
            ];

            let reseñasTab = null;
            for (const sel of selectorsReseñas) {
                try {
                    reseñasTab = await driver.wait(until.elementLocated(By.xpath(sel)), 3000);
                    if (reseñasTab) {
                        console.log('Pestaña encontrada con:', sel);
                        await driver.executeScript("arguments[0].click();", reseñasTab);
                        await driver.sleep(3000);
                        break;
                    }
                } catch (_) { }
            }

            if (!reseñasTab) {
                // Fallback: hacer click en las estrellas de calificación (siempre llevan a Reviews)
                console.log('No se encontró pestaña, intentando click en estrellas...');
                try {
                    const stars = await driver.findElement(By.css('span[role="img"][aria-label*="estrella"], span[role="img"][aria-label*="star"]'));
                    await driver.executeScript("arguments[0].click();", stars);
                    await driver.sleep(3000);
                    console.log('Click en estrellas OK.');
                    reseñasTab = stars;
                } catch (_) { }
            }

            if (!reseñasTab) {
                // Fallback 2: buscar el contenedor de reseñas div.m6QErb directamente después de esperar más
                console.log('Esperando carga tardía de reseñas...');
                await driver.sleep(4000);
                const tardios = await driver.findElements(By.css(SELECTORS.reviewBlock));
                if (tardios.length > 0) {
                    console.log('Reseñas cargadas tardíamente:', tardios.length);
                    reseñasTab = tardios[0];
                }
            }

            if (!reseñasTab) {
                const html = await driver.getPageSource();
                fs.writeFileSync(path.join(__dirname, 'debug_dom.html'), html);
                throw new Error("No se pudo encontrar la pestaña de Reseñas/Reviews. Se guardó debug_dom.html");
            }
        } else {
            console.log('Reseñas ya visibles directamente desde la URL.');
        }

        const reseñas = await extraerReseñasPorTandas(driver);
        console.log('Reseñas encontradas:', reseñas.length, `(meta ${META_RESEÑAS})`);

        const lineas = reseñas.map((r, i) => {
            const cab = `--- ${i + 1}. ${r.autor || '?'} (${r.estrellas ?? '?'} estrellas) ${r.fecha || ''} ---`;
            const txt = r.texto || '(sin texto)';
            const resp = r.respuestaPropietario ? `  [Respuesta:] ${r.respuestaPropietario}` : '';
            return [cab, txt, resp].filter(Boolean).join('\n');
        });
        const contenido = lineas.join('\n\n');
        const outPath = path.resolve(process.env.OUTPUT_FILE || 'reseñas.txt');
        fs.writeFileSync(outPath, contenido, 'utf8');
        console.log('Salida guardada en:', outPath);

        await driver.sleep(1000);
    } finally {
        await driver.quit();
    }
})();

async function obtenerReviewId(bloque) {
    try {
        const card = await bloque.findElement(By.xpath('./ancestor::div[@data-review-id][1]'));
        return await card.getAttribute('data-review-id');
    } catch (_) { return null; }
}

async function extraerReseñasPorTandas(driver) {
    const yaVistas = new Set();
    const reseñas = [];
    await clicAbrirCerrarBuscador(driver);

    for (let ronda = 0; ronda < MAX_TANDAS; ronda++) {
        if (reseñas.length >= META_RESEÑAS) break;
        await enviarFlechasAbajo(driver, FLECHAS_ABAJO);
        await driver.sleep(300);

        const bloques = await driver.findElements(By.css(SELECTORS.reviewBlock));
        let nuevasEnRonda = 0;

        for (const bloque of bloques) {
            try {
                const id = await obtenerReviewId(bloque);
                if (!id || yaVistas.has(id)) continue;
                yaVistas.add(id);
                const autor = await obtenerAutor(driver, bloque);
                const estrellas = await obtenerEstrellas(bloque);
                const fecha = await obtenerTexto(bloque, SELECTORS.date);
                await expandirSiHayVerMas(driver, bloque);
                const text = await obtenerTexto(bloque, SELECTORS.reviewText);
                const respuestaPropietario = await obtenerRespuestaPropietario(bloque);
                reseñas.push({ autor: autor || null, estrellas: estrellas ?? null, fecha: fecha || null, texto: text || null, respuestaPropietario: respuestaPropietario || null });
                nuevasEnRonda++;
                if (reseñas.length >= META_RESEÑAS) break;
            } catch (e) { console.warn('Error en bloque:', e.message); }
        }

        if (reseñas.length >= META_RESEÑAS) break;
        if (ronda < MAX_TANDAS - 1) {
            await driver.sleep(PAUSA_ENTRE_TANDAS_SEC * 1000);
            await clicAbrirCerrarBuscador(driver);
        }
    }
    return reseñas;
}

async function expandirSiHayVerMas(driver, bloque) {
    const buscarYClick = async (root) => {
        const selectores = ['button[aria-label="Ver más"]', 'button[aria-label*="más"]', 'button[aria-label*="More"]', 'button[aria-label*="more"]', './/button[contains(., "Ver más") or contains(., "más") or contains(., "More") or contains(., "more")]'];
        for (const sel of selectores) {
            try {
                const by = sel.startsWith('.//') ? By.xpath(sel) : By.css(sel);
                const btns = await root.findElements(by);
                for (const btn of btns) {
                    try { await btn.click(); } catch (_) { await driver.executeScript('arguments[0].click();', btn); }
                    await driver.sleep(PAUSA_DESPUES_VER_MAS_MS);
                    return true;
                }
            } catch (_) { }
        }
        return false;
    };
    if (await buscarYClick(bloque)) return;
    try {
        const card = await bloque.findElement(By.xpath('./ancestor::div[@data-review-id][1]'));
        await buscarYClick(card);
    } catch (_) { }
}

async function obtenerAutor(driver, bloque) {
    try {
        const card = await bloque.findElement(By.xpath('./ancestor::div[@aria-label][1]'));
        const aria = await card.getAttribute('aria-label');
        if (aria && !/^(Foto de|Me gusta|Compartir|Acciones)/i.test(aria)) return aria.trim();
    } catch (_) { }
    return null;
}

function parsearEstrellas(ariaLabel) {
    if (!ariaLabel || typeof ariaLabel !== 'string') return null;
    const n = ariaLabel.replace(/\D/g, '');
    const num = parseInt(n, 10);
    return isNaN(num) ? null : Math.min(5, Math.max(1, num));
}

async function obtenerEstrellas(bloque) {
    try {
        const el = await bloque.findElement(By.css(SELECTORS.rating));
        return parsearEstrellas(await el.getAttribute('aria-label'));
    } catch (_) { return null; }
}

async function obtenerTexto(bloque, selector) {
    try {
        const el = await bloque.findElement(By.css(selector));
        return (await el.getText())?.trim() || null;
    } catch (_) { return null; }
}

async function obtenerRespuestaPropietario(bloque) {
    try {
        const el = await bloque.findElement(By.css(SELECTORS.ownerReplyText));
        return (await el.getText())?.trim() || null;
    } catch (_) { return null; }
}
