# Detection report

Weights: `C:\Users\PC\Desktop\M2S1\AIOT\smart-waste-ai-simulation\backend\ai\weights\best.pt`
Test split: `C:\Users\PC\Desktop\M2S1\AIOT\smart-waste-ai-simulation\backend\ai\datasets\waste\images\test`

| Class | Precision | Recall | mAP50 | mAP50-95 |
|---|---:|---:|---:|---:|
| ordinary_waste | 0.958 | 0.909 | 0.944 | 0.895 |
| battery | 0.877 | 0.841 | 0.940 | 0.911 |
| electronic_waste | 0.916 | 0.894 | 0.921 | 0.888 |
| aerosol | — | — | — | — |
| medical_sharp | — | — | — | — |

All classes: mAP50 **0.935**, mAP50-95 **0.898**

Classes with no instances in the test split show — — that is missing data,
not a model failure. Do not report a metric for them.
RecyBat24 (CC BY-NC-ND) is not part of this test split; it may only be used for
private evaluation and its numbers must be reported separately.
