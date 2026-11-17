"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInPageDetection = runInPageDetection;
function runInPageDetection() {
    const SENSITIVE_TOKENS = [
        'cc-number', 'cc-csc', 'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-name',
        'cc-type', 'current-password', 'new-password', 'one-time-code',
    ];
    const MEDIUM_TOKENS = [
        'tel', 'tel-national', 'tel-country-code', 'address-line1', 'address-line2',
        'address-line3', 'address-level1', 'address-level2', 'postal-code', 'bday',
        'country', 'country-name',
    ];
    const CANARY = {
        'name': 'CANARY Person',
        'given-name': 'CANARY',
        'additional-name': 'Autofill',
        'family-name': 'Person',
        'honorific-prefix': 'Dr.',
        'honorific-suffix': 'Jr.',
        'nickname': 'canary',
        'username': 'canary_user',
        'current-password': 'Can4ry-Pass!',
        'new-password': 'Can4ry-Pass!',
        'one-time-code': '000000',
        'organization-title': 'QA',
        'organization': 'Canary Corp',
        'street-address': '1 Canary Way\nApt 42',
        'address-line1': '1 Canary Way',
        'address-line2': 'Apt 42',
        'address-line3': 'Suite 7',
        'address-level4': 'Canary District',
        'address-level3': 'Canary Town',
        'address-level2': 'Cupertino',
        'address-level1': 'CA',
        'postal-code': '95014',
        'country': 'US',
        'country-name': 'United States',
        'tel': '+1-555-013-3700',
        'tel-country-code': '1',
        'tel-national': '555-013-3700',
        'tel-area-code': '555',
        'tel-local': '013-3700',
        'tel-extension': '42',
        'email': 'canary@probe.invalid',
        'url': 'https://canary.example',
        'photo': 'https://canary.example/photo.png',
        'impp': 'xmpp:canary@probe.invalid',
        'bday': '1990-01-01',
        'bday-day': '01',
        'bday-month': '01',
        'bday-year': '1990',
        'sex': 'Prefer not to say',
        'cc-name': 'CANARY PERSON',
        'cc-given-name': 'CANARY',
        'cc-family-name': 'PERSON',
        'cc-number': '4111111111111111',
        'cc-exp': '12/29',
        'cc-exp-month': '12',
        'cc-exp-year': '2029',
        'cc-csc': '123',
        'cc-type': 'Visa',
        'transaction-currency': 'USD',
        'transaction-amount': '1.00',
        'language': 'en',
    };
    const NAME_HINTS = [
        [/cc[-_]?num|card[-_]?num|cardnumber|pan/i, 'cc-number'],
        [/cvv|cvc|csc|security[-_]?code/i, 'cc-csc'],
        [/exp|expiry|expiration/i, 'cc-exp'],
        [/card[-_]?holder|cc[-_]?name/i, 'cc-name'],
        [/e[-_]?mail/i, 'email'],
        [/phone|mobile|tel/i, 'tel'],
        [/zip|postal/i, 'postal-code'],
        [/address|addr|street/i, 'address-line1'],
        [/city/i, 'address-level2'],
        [/state|province|region/i, 'address-level1'],
        [/country/i, 'country-name'],
        [/first[-_]?name|given/i, 'given-name'],
        [/last[-_]?name|family|surname/i, 'family-name'],
        [/full[-_]?name|^name$/i, 'name'],
        [/pass(word)?|pwd/i, 'current-password'],
        [/user[-_]?name|login/i, 'username'],
    ];
    function extractToken(autocomplete) {
        if (!autocomplete)
            return null;
        const tokens = autocomplete.trim().toLowerCase().split(/\s+/);
        const meaningful = tokens.filter((t) => !t.startsWith('section-') &&
            !['shipping', 'billing', 'home', 'work', 'mobile', 'fax', 'pager', 'webauthn', 'on', 'off'].includes(t));
        return meaningful.length ? meaningful[meaningful.length - 1] : null;
    }
    function tokenFromName(el) {
        const key = `${el.name || ''} ${el.id || ''}`;
        if (!key.trim())
            return null;
        for (const [re, token] of NAME_HINTS) {
            if (re.test(key))
                return token;
        }
        return null;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    function labelFor(el) {
        const input = el;
        if (input.labels && input.labels.length) {
            return Array.from(input.labels)
                .map((l) => (l.textContent || '').trim())
                .filter(Boolean)
                .join(' / ')
                .slice(0, 120);
        }
        const aria = el.getAttribute('aria-label');
        if (aria)
            return aria.slice(0, 120);
        return '';
    }
    function analyzeVisibility(el) {
        const signals = new Set();
        const input = el;
        if (input.type === 'hidden')
            signals.add('type=hidden');
        const cs = getComputedStyle(el);
        if (cs.display === 'none')
            signals.add('display:none');
        if (cs.visibility === 'hidden' || cs.visibility === 'collapse')
            signals.add('visibility:hidden');
        if (parseFloat(cs.opacity) < 0.05)
            signals.add('opacity≈0 (transparent)');
        if (parseFloat(cs.fontSize) < 1)
            signals.add('font-size≈0');
        if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clip === 'rect(0px 0px 0px 0px)')
            signals.add('clip:rect(0)');
        if (cs.clipPath && /inset\(\s*(50%|100%)/.test(cs.clipPath))
            signals.add('clip-path fully clipped');
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2)
            signals.add(`tiny size ${Math.round(r.width)}×${Math.round(r.height)}px`);
        if (r.bottom < 0 || r.right < 0 || r.left > vw || r.top > vh) {
            signals.add(`off-screen at (${Math.round(r.left)}, ${Math.round(r.top)})`);
        }
        const transparentColor = cs.color === 'rgba(0, 0, 0, 0)' || cs.color === 'transparent';
        const transparentBg = cs.backgroundColor === 'rgba(0, 0, 0, 0)' || cs.backgroundColor === 'transparent';
        if (transparentColor && transparentBg && cs.display !== 'none') {
            signals.add('transparent text on transparent background');
        }
        if (cs.transform && cs.transform !== 'none') {
            const m = cs.transform.match(/matrix\(([^)]+)\)/);
            if (m) {
                const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
                if (parts.length === 6) {
                    const [a, , , d, tx, ty] = parts;
                    if (Math.abs(a) < 0.01 && Math.abs(d) < 0.01)
                        signals.add('transform: scale≈0');
                    if (Math.abs(tx) > vw * 2 || Math.abs(ty) > vh * 2)
                        signals.add('transform: translated far away');
                }
            }
        }
        let p = el.parentElement;
        let depth = 0;
        while (p && depth < 12) {
            const pcs = getComputedStyle(p);
            if (pcs.display === 'none') {
                signals.add('inside display:none container');
                break;
            }
            if (pcs.visibility === 'hidden' || pcs.visibility === 'collapse') {
                signals.add('inside visibility:hidden container');
                break;
            }
            if (parseFloat(pcs.opacity) < 0.05) {
                signals.add('inside opacity≈0 container');
                break;
            }
            const pr = p.getBoundingClientRect();
            const clips = pcs.overflow === 'hidden' || pcs.overflowX === 'hidden' || pcs.overflowY === 'hidden';
            if (clips && (pr.height < 2 || pr.width < 2)) {
                signals.add('inside collapsed (0-size, overflow:hidden) container');
                break;
            }
            p = p.parentElement;
            depth++;
        }
        if (r.width >= 2 && r.height >= 2 &&
            r.bottom >= 0 && r.right >= 0 && r.left <= vw && r.top <= vh &&
            cs.display !== 'none') {
            const cx = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1);
            const cy = Math.min(Math.max(r.top + r.height / 2, 1), vh - 1);
            const top = document.elementFromPoint(cx, cy);
            let covered = false;
            if (top && top !== el && !el.contains(top)) {
                const isOwnLabel = top.control === el ||
                    (input.labels && Array.from(input.labels).some((l) => l.contains(top)));
                if (!isOwnLabel) {
                    const tag = top.tagName.toLowerCase();
                    const cls = (top.getAttribute('class') || '').slice(0, 40);
                    signals.add(`covered by <${tag}${cls ? '.' + cls : ''}> (elementFromPoint)`);
                    covered = true;
                }
            }
            if (!covered) {
                const all = document.querySelectorAll('body *');
                for (const other of Array.from(all)) {
                    if (other === el || el.contains(other) || other.contains(el))
                        continue;
                    const ocs = getComputedStyle(other);
                    if (ocs.display === 'none' || parseFloat(ocs.opacity) < 0.05)
                        continue;
                    const bg = ocs.backgroundColor;
                    const opaqueBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
                    const hasBgImg = ocs.backgroundImage && ocs.backgroundImage !== 'none';
                    if (!opaqueBg && !hasBgImg)
                        continue;
                    const or = other.getBoundingClientRect();
                    if (cx < or.left || cx > or.right || cy < or.top || cy > or.bottom)
                        continue;
                    const paintedAbove = !!(el.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) ||
                        (ocs.position !== 'static' && parseInt(ocs.zIndex || '0', 10) > 0);
                    if (paintedAbove) {
                        const tag = other.tagName.toLowerCase();
                        const cls = (other.getAttribute('class') || '').slice(0, 40);
                        signals.add(`visually covered by <${tag}${cls ? '.' + cls : ''}>`);
                        break;
                    }
                }
            }
        }
        return Array.from(signals);
    }
    const fieldEls = Array.from(document.querySelectorAll('input, select, textarea'));
    const fields = [];
    fieldEls.forEach((el, index) => {
        const input = el;
        const type = (input.type || el.tagName.toLowerCase()).toLowerCase();
        if (['submit', 'button', 'reset', 'image', 'file'].includes(type))
            return;
        const autocomplete = (el.getAttribute('autocomplete') || '').trim();
        const token = extractToken(autocomplete) || tokenFromName(input);
        const acOff = autocomplete.toLowerCase() === 'off';
        if (!token || acOff)
            return;
        const r = el.getBoundingClientRect();
        const hidingSignals = analyzeVisibility(el);
        const hidden = hidingSignals.length > 0;
        const sensitive = SENSITIVE_TOKENS.includes(token) || MEDIUM_TOKENS.includes(token);
        const form = el.closest('form');
        fields.push({
            index,
            tag: el.tagName.toLowerCase(),
            type,
            name: el.name || '',
            id: el.id || '',
            autocomplete,
            token,
            label: labelFor(el),
            placeholder: input.placeholder || '',
            formIndex: form ? Array.from(document.forms).indexOf(form) : null,
            rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
            hidingSignals,
            hidden,
            sensitive,
            capturedValue: null,
        });
    });
    const nativeSetters = {};
    const protoFor = {
        input: window.HTMLInputElement.prototype,
        textarea: window.HTMLTextAreaElement.prototype,
        select: window.HTMLSelectElement.prototype,
    };
    for (const tag of Object.keys(protoFor)) {
        const desc = Object.getOwnPropertyDescriptor(protoFor[tag], 'value');
        nativeSetters[tag] = desc && desc.set
            ? (el, v) => desc.set.call(el, v)
            : (el, v) => { el.value = v; };
    }
    fieldEls.forEach((el, index) => {
        const report = fields.find((f) => f.index === index);
        if (!report || !report.token)
            return;
        const canary = CANARY[report.token];
        if (canary === undefined)
            return;
        const tag = el.tagName.toLowerCase();
        try {
            nativeSetters[tag](el, canary);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            report.capturedValue = el.value;
        }
        catch {
        }
    });
    const forms = Array.from(document.forms).map((form, fi) => {
        const entries = [];
        try {
            const fd = new FormData(form);
            fd.forEach((value, name) => {
                const el = form.elements.namedItem(name);
                const node = el instanceof RadioNodeList ? el[0] : el;
                const idx = node ? fieldEls.indexOf(node) : -1;
                const report = fields.find((f) => f.index === idx);
                entries.push({
                    name,
                    value: String(value),
                    hidden: report ? report.hidden : false,
                });
            });
        }
        catch {
        }
        return {
            index: fi,
            action: form.getAttribute('action') || '(same page)',
            method: (form.getAttribute('method') || 'GET').toUpperCase(),
            submittedEntries: entries,
        };
    });
    return {
        title: document.title,
        fields,
        forms,
        visibleFieldCount: fields.filter((f) => !f.hidden).length,
        hiddenFieldCount: fields.filter((f) => f.hidden).length,
        hiddenSensitiveCount: fields.filter((f) => f.hidden && f.sensitive).length,
    };
}
