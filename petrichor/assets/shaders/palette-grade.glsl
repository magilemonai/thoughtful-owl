precision mediump float;

uniform sampler2D uMainSampler;
uniform vec3 uTint;         // RGB multiplier for time-of-day
uniform float uBrightness;  // 0-2
uniform float uSaturation;  // 0-2
uniform float uVignetteStrength; // 0-1

varying vec2 outTexCoord;

void main() {
    vec4 color = texture2D(uMainSampler, outTexCoord);

    // Apply time-of-day tint
    color.rgb *= uTint;

    // Brightness
    color.rgb *= uBrightness;

    // Saturation (luminance-preserving)
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(luma), color.rgb, uSaturation);

    // Vignette
    vec2 center = outTexCoord - 0.5;
    float dist = length(center);
    float vignette = 1.0 - smoothstep(0.3, 0.75, dist) * uVignetteStrength;
    color.rgb *= vignette;

    // Clamp
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    gl_FragColor = color;
}
