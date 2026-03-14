import test from "node:test";
import assert from "node:assert/strict";
import {
  describeDecisionCalculatorThresholds,
  evaluateDecisionCalculator,
  resolveDecisionCalculatorAvailability
} from "../app/lib/decisionCalculator.ts";

test("free users cannot use the calculator while paid users can", () => {
  assert.deepEqual(
    resolveDecisionCalculatorAvailability({
      frameType: "Frame A",
      isPaid: false
    }),
    {
      frame: "Frame A",
      isSupported: true,
      isVisible: false,
      showUpgradeCta: true
    }
  );

  assert.deepEqual(
    resolveDecisionCalculatorAvailability({
      frameType: "Frame B",
      isPaid: true
    }),
    {
      frame: "Frame B",
      isSupported: true,
      isVisible: true,
      showUpgradeCta: false
    }
  );
});

test("Frame A calculates yen per hour and returns use_now for efficient spend", () => {
  const result = evaluateDecisionCalculator({
    card: {
      frame_type: "Frame A",
      threshold_json: {}
    },
    inputs: {
      price: 3600,
      play_time: 12
    }
  });

  assert.equal(result?.judgmentType, "use_now");
  assert.equal(result?.metricLabel, "1時間単価");
  assert.equal(result?.metricValue, 300);
});

test("Frame B calculates cost per hour and returns skip when usage is too low", () => {
  const result = evaluateDecisionCalculator({
    card: {
      frame_type: "Frame B",
      threshold_json: {}
    },
    inputs: {
      monthly_cost: 1480,
      watch_time: 1
    }
  });

  assert.equal(result?.judgmentType, "skip");
  assert.equal(result?.metricValue, 1480);
});

test("Frame D calculates ad ratio and returns skip above the threshold", () => {
  const result = evaluateDecisionCalculator({
    card: {
      frame_type: "Frame D",
      threshold_json: {}
    },
    inputs: {
      ad_time: 240,
      watch_time: 1200
    }
  });

  assert.equal(result?.judgmentType, "skip");
  assert.equal(result?.metricValue, 20);
});

test("threshold summaries reflect default frame rules", () => {
  const summary = describeDecisionCalculatorThresholds({
    card: {
      frame_type: "Frame B",
      threshold_json: {}
    }
  });

  assert.equal(summary?.frame, "Frame B");
  assert.match(summary?.summary ?? "", /600\/時間以下なら採用/);
});
