export const normalGaugePayload = {
  gauges: [{ lid: "NORMAL1", name: "Normal River", latitude: 41, longitude: -96, usgsId: "01234567", actionStage: 7, minorStage: 10, moderateStage: 14, majorStage: 18 }],
};

export const normalStageflowPayload = {
  observed: { secondaryUnits: "cfs", data: [{ validTime: "2026-10-09T12:00:00Z", primary: 9.2, secondary: 1200 }] },
  forecast: { secondaryUnits: "cfs", data: [{ validTime: "2026-10-09T18:00:00Z", primary: 12.4, secondary: 1800 }, { validTime: "2026-10-10T06:00:00Z", primary: 15.6, secondary: 2400 }] },
};

export const observedOnlyStageflowPayload = {
  observed: { secondaryUnits: "cfs", data: [{ validTime: "2026-10-09T12:00:00Z", primary: 6.8, secondary: 700 }] },
};

export const majorFloodGaugePayload = {
  gauges: [{ lid: "MAJOR1", name: "Major River", latitude: 42, longitude: -97, actionStage: 7, minorStage: 10, moderateStage: 14, majorStage: 18 }],
};

export const majorFloodStageflowPayload = {
  observed: { data: [{ validTime: "2026-10-09T12:00:00Z", primary: 18.4, secondary: 3000 }] },
  forecast: { data: [{ validTime: "2026-10-09T18:00:00Z", primary: 20.2, secondary: 4200 }] },
};

export const outOfServiceGaugePayload = {
  gauges: [{ lid: "OFFLINE1", name: "Offline Gauge", latitude: 43, longitude: -98, status: "out-of-service" }],
};
