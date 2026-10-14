import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { describe, expect, it, vi } from 'vitest';

const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const program = parse(script, { ecmaVersion: 'latest' });
function declaration(name: string) {
  const node = program.body.find((item) => item.type === 'FunctionDeclaration' && item.id?.name === name);
  if (!node) throw new Error(`Missing ${name}`);
  return script.slice(node.start, node.end);
}

// Exercise the actual render callback. Nonempty buffers alone did not catch
// the v4 matrix mismatch: the previous callback silently skipped every draw.
describe('3D plume draw contract', () => {
  for (const wrapped of [false, true]) {
    it(`draws with the ${wrapped ? 'wrapped v5' : 'bundled v4'} matrix`, () => {
      const gl = {
        useProgram: vi.fn(), bindBuffer: vi.fn(), enableVertexAttribArray: vi.fn(),
        vertexAttribPointer: vi.fn(), uniformMatrix4fv: vi.fn(), enable: vi.fn(),
        blendFunc: vi.fn(), depthFunc: vi.fn(), disable: vi.fn(), depthMask: vi.fn(),
        drawArrays: vi.fn(), disableVertexAttribArray: vi.fn(),
      };
      const matrix = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      const report = vi.fn();
      const context = {
        gl, matrix, wrapped, Float32Array, plume3dCustomLayerId: 'mesh', reportPlume3dFailure: report,
        plumeMapUsesRelativeTerrain: () => !wrapped,
      };
      const draws = runInNewContext(`${declaration('createPlume3dCustomLayer')}
        const layer = createPlume3dCustomLayer();
        Object.assign(layer, { visible: true, vertexBuffer: {}, vertexCount: 96, program: {},
          origin: { x: 0.25, y: 0.5, meterInMercatorCoordinateUnits: () => 0.001 },
          map: { getTerrain: () => ({}), getCameraTargetElevation: () => 100 } });
        layer.render(gl, wrapped ? { defaultProjectionData: { mainMatrix: matrix } } : matrix);
        layer.drawCount;`, context);
      expect(gl.drawArrays).toHaveBeenCalledOnce();
      expect(draws).toBe(1);
      expect(report).not.toHaveBeenCalled();
      const translated = gl.uniformMatrix4fv.mock.calls[0][2] as Float32Array;
      expect(translated[12]).toBeCloseTo(0.25);
      expect(translated[13]).toBeCloseTo(0.5);
      expect(translated[14]).toBeCloseTo(wrapped ? 0 : -0.1);
    });
  }

  it('reports a missing camera matrix instead of claiming a successful draw', () => {
    const report = vi.fn();
    runInNewContext(`${declaration('createPlume3dCustomLayer')}
      const layer = createPlume3dCustomLayer();
      Object.assign(layer, { visible: true, vertexBuffer: {}, vertexCount: 96, program: {} });
      layer.render({}, {}); layer.render({}, {});`, {
      plume3dCustomLayerId: 'mesh', reportPlume3dFailure: report,
    });
    expect(report).toHaveBeenCalledOnce();
  });

  it('keeps missing DEM samples missing and converts v4 relative terrain to MSL', () => {
    const sample = vi.fn().mockReturnValueOnce(null).mockReturnValueOnce(-12);
    const result = runInNewContext(`${declaration('plumeMapUsesRelativeTerrain')}
      ${declaration('plume3dTerrainElevation')}
      [plume3dTerrainElevation([0, 0], 80), plume3dTerrainElevation([0, 0], 80)]`, {
      window: { maplibregl: { version: '4.7.1' } },
      plumeMap: { queryTerrainElevation: sample, getCameraTargetElevation: () => 100 },
    });
    expect(result).toEqual([80, 88]);
  });

  it('positions the ground-view camera at eye height without altering plume geometry', () => {
    const calculate = vi.fn().mockReturnValue({ center: [0, 0], zoom: 23, pitch: 82 });
    const ease = vi.fn();
    const mesh = { origin: { lon: -86, lat: 33 }, windFromDeg: 180,
      paths: [{ zoneRank: 3, sections: [{ footprintWidthM: 4, terrainElevationM: 120 }] }] };
    const before = JSON.stringify(mesh);
    runInNewContext(`${declaration('setPlumeGroundView')}\nsetPlumeGroundView()`, {
      currentPlume3dMeshData: mesh, plumeViewIsPlume: () => true,
      plumeMap: { calculateCameraOptionsFromTo: calculate, easeTo: ease },
      plume3dTerrainElevation: () => 120, localMetersToLngLat: (point: number[]) => point,
      window: { maplibregl: { LngLat: class { constructor(public lng: number, public lat: number) {} } } },
      setText: vi.fn(),
    });
    expect(calculate.mock.calls[0][1]).toBeCloseTo(121.7);
    expect(calculate.mock.calls[0][3]).toBe(120);
    expect(ease).toHaveBeenCalledWith(expect.objectContaining({ zoom: 23, pitch: 82 }));
    expect(JSON.stringify(mesh)).toBe(before);
  });
});
