import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const consoleSource = readFileSync(new URL('../server/public/monitoring-console.js', import.meta.url), 'utf8');
const consoleCss = readFileSync(new URL('../server/public/monitoring-console.css', import.meta.url), 'utf8');
const mainScript = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');

describe('EMERGENZ Monitoring V1', () => {
  it('provides the Monitoring route, title, digital display icon, subtitle, and primary reading form', () => {
    expect(html).toContain('id="monitor" class="view emergenz-monitoring-page"');
    expect(html).toContain('data-page-name="Monitoring"');
    expect(html).toContain('Environmental Monitoring • Field Readings • Deployment Intelligence');
    expect(html).toContain('class="em-monitor-screen-icon"');
    expect(html).toContain('<span class="app-nav-label label">Monitoring</span>');
    expect(html).toContain('data-view="monitor">MONITORING</button>');
    expect(html).toContain('id="monitor-manual-form"');
    expect(html).toContain('id="monitor-map-canvas"');
    expect(html).toContain('id="monitor-console-units"');
    expect(html).toContain('class="em-monitor-middle"');
    expect(html).toContain('class="em-monitor-right"');
    expect(html).toContain('id="monitor-map-style"');
    expect(html).toContain('id="monitor-location-count"');
    expect(html).toContain('src="monitoring-console.js?v=2"');
  });

  it('seeds precisely 17 starter slots without inventing sensor packages, GPS, or readings', () => {
    expect(consoleSource).toContain("...Array.from({length:4}, (_,i)=>['MultiRAE',i+1");
    expect(consoleSource).toContain("...Array.from({length:2}, (_,i)=>['MultiRAE Pro',i+1");
    expect(consoleSource).toContain("...Array.from({length:4}, (_,i)=>['AreaRAE',i+1");
    expect(consoleSource).toContain("['Ludlum RAD',null,'Ludlum Measurements']");
    expect(consoleSource).toContain("...Array.from({length:2}, (_,i)=>['ToxiRAE',i+1");
    expect(consoleSource).toContain("...Array.from({length:4}, (_,i)=>['RadEye',i+1");
    expect(consoleSource).toContain("status:'Available', readinessDataMode:'Unverified'");
    expect(consoleSource).toContain("serialNumber:'', sensorPackage:''");
    expect(consoleSource).toContain('inventory.some(v=>v.id===id');
    expect(consoleSource).not.toContain('sample-readings');
  });

  it('keeps manual reading collection separate from unsupported telemetry', () => {
    expect(consoleSource).toContain("dataMode:'Manual'");
    expect(consoleSource).toContain("addEventListener('submit',saveReading)");
    expect(consoleSource).toContain("addEventListener('click',()=>prepareReading(item.id))");
    expect(consoleSource).toContain('NO READINGS RECORDED');
    expect(consoleSource).toContain('if(!a){status(');
    expect(html).toContain('No telemetry connection');
    expect(html).toContain('Saved as a manual observation');
  });

  it('only maps user-assigned coordinates, without simulated polygons or auto-generated monitor pins', () => {
    expect(consoleSource).toContain('assignments.filter(a=>pointOf(a))');
    expect(consoleSource).toContain(" $('monitor-map-empty').hidden=rows.length>0;".trim());
    expect(html).toContain('No deployed monitors have map coordinates');
    expect(mainScript).toContain('window.getHazMatIQMonitorMarkers()');
    expect(mainScript).toContain("layer !== 'monitors'");
    expect(mainScript).toContain("window.addEventListener('emergenz:monitoring-updated'");
    expect(mainScript).toContain("window.addEventListener('emergenz:focus-monitor-live-map'");
    expect(consoleSource).not.toContain('hotZoneGeoJson');
    expect(consoleSource).not.toContain('fill-extrusion');
    expect(html).toContain('No inferred hot zones, plumes, or ERG boundaries.');
  });

  it('keeps manufacturer variants honest, and the device panel independently scrollable', () => {
    expect(consoleSource).toContain('MODEL PHOTO PENDING');
    expect(consoleSource).toContain('manufacturer reference product photograph');
    expect(consoleSource).toContain("if(n.includes('multirae lite')) return ''");
    expect(consoleCss).toContain('em-monitor-scroll');
    expect(consoleCss).toContain('grid-template-columns:minmax(360px,43fr) minmax(245px,20fr) minmax(370px,37fr)');
    expect(consoleCss).toContain('em-kpi-alarms');
    expect(consoleCss).toContain('em-kpi-manual');
    expect(consoleCss).toContain('overflow-y:auto');
    expect(html).toContain('id="monitor-unit-dialog"');
    expect(consoleSource).toContain('function saveUnit(e)');
    expect(consoleSource).toContain("window.HazMatIQ.initializeEquipmentPage=()");
  });
});
