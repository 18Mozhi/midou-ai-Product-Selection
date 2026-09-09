window.RELEASE_LOGIC = {
  gatePassed: function (gate, p) {
    const thresholds = {
      errorRateStopPercent: p.error_rate_stop_percent,
      readP95StopMs: p.read_p95_stop_ms,
      writeP95StopMs: p.write_p95_stop_ms,
      asyncLagStopSeconds: p.async_lag_stop_seconds,
    };
    return function () {
      const finiteMetric = (value) =>
        value !== null && value !== undefined && Number.isFinite(Number(value));
      const gatePassed = (gate) =>
        Boolean(
          gate &&
          gate.status === "passed" &&
          Number(gate.observe_seconds) >= this.policy.minimumObservationSeconds &&
          Number(gate.traffic_percent) > 0 &&
          Number(gate.sample_count) > 0 &&
          [
            gate.error_rate_percent,
            gate.read_p95_ms,
            gate.write_p95_ms,
            gate.async_lag_seconds,
          ].every(finiteMetric) &&
          Number(gate.error_rate_percent) < thresholds.errorRateStopPercent &&
          Number(gate.read_p95_ms) <= thresholds.readP95StopMs &&
          Number(gate.write_p95_ms) <= thresholds.writeP95StopMs &&
          Number(gate.async_lag_seconds) <= thresholds.asyncLagStopSeconds,
        );
      return gatePassed(gate);
    }.call({ policy: { minimumObservationSeconds: p.minimum_observation_seconds } });
  },
};
