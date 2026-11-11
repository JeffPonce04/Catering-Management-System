<?php

return [
    'face_recognition' => [
        'url' => env('FACE_RECOGNITION_URL', 'http://127.0.0.1:5001'),
        // Face distance threshold; tune with a representative validation set.
        'threshold' => (float) env('FACE_RECOGNITION_THRESHOLD', 0.30),
        // Keep false until the matching service is installed, configured and validated.
        'enforced' => (bool) env('FACE_RECOGNITION_ENFORCED', false),
    ],
];
