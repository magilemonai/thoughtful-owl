precision mediump float;

uniform sampler2D uMainSampler;
uniform vec3 uAmbientColor;    // RGB 0-1
uniform float uAmbientStrength; // 0-1
uniform vec2 uResolution;

// Point lights: up to 8
uniform int uLightCount;
uniform vec2 uLightPositions[8];
uniform vec3 uLightColors[8];
uniform float uLightRadii[8];
uniform float uLightIntensities[8];

varying vec2 outTexCoord;

void main() {
    vec4 color = texture2D(uMainSampler, outTexCoord);
    vec2 pixelPos = outTexCoord * uResolution;

    // Start with ambient light
    vec3 light = uAmbientColor * uAmbientStrength;

    // Add point lights
    for (int i = 0; i < 8; i++) {
        if (i >= uLightCount) break;

        float dist = distance(pixelPos, uLightPositions[i]);
        float attenuation = 1.0 - smoothstep(0.0, uLightRadii[i], dist);
        attenuation *= uLightIntensities[i];

        // Soft flickering-ready contribution
        light += uLightColors[i] * attenuation;
    }

    // Apply lighting to scene
    color.rgb *= clamp(light, 0.0, 1.5);

    gl_FragColor = color;
}
