#define VERT_A 100000

vec2 texSize = textureSize(Sampler0, 0);
cem_texture_source = 0;
cem_texture_frame_count = 1;
cem_texture_frame_ticks = 1;
vec3 Pos1 = round(cem_pos1.xyz * VERT_A / cem_pos1.w) / VERT_A;
vec3 Pos2 = round(cem_pos3.xyz * VERT_A / cem_pos3.w) / VERT_A;
float vertex2Gradient = abs(dFdx(cem_pos2.w)) + abs(dFdy(cem_pos2.w));
float vertex4Gradient = abs(dFdx(cem_pos4.w)) + abs(dFdy(cem_pos4.w));
bool firstTriangle = vertex2Gradient > vertex4Gradient;
vec3 carriedPos = firstTriangle
    ? round(cem_pos2.xyz * VERT_A / cem_pos2.w) / VERT_A
    : round(cem_pos4.xyz * VERT_A / cem_pos4.w) / VERT_A;
vec3 Pos3 = firstTriangle ? carriedPos : Pos1 + Pos2 - carriedPos;
vec3 Pos4 = firstTriangle ? Pos1 + Pos2 - carriedPos : carriedPos;

// if (ProjMat[3][0] == -1)
// {
//     Pos1 /= 0x1000;
//     Pos2 /= 0x1000;
//     Pos3 /= 0x1000;
// }

vec3 tangent = normalize(Pos3 - Pos1);
vec3 bitangent = normalize(Pos3 - Pos2);
vec3 normalT = normalize(cross(tangent, bitangent));

#ifdef MINUS_Z
if (ProjMat[3][0] == -1)
    normalT *= -1;
#endif

if (cem_reverse == 1)
{
    tangent = -tangent;
    bitangent = -bitangent;
}

mat3 TBN = mat3(tangent, bitangent, normalT);

vec2 UV1 = round(cem_uv1.xy / cem_uv1.z);
vec2 UV2 = round(cem_uv3.xy / cem_uv3.z);
vec2 carriedUv = firstTriangle
    ? round(cem_uv2.xy / cem_uv2.z)
    : round(cem_uv4.xy / cem_uv4.z);
vec2 UV3 = firstTriangle ? carriedUv : UV1 + UV2 - carriedUv;
vec2 UV4 = firstTriangle ? UV1 + UV2 - carriedUv : carriedUv;

vec2 stp = min(UV1, UV2);
vec2 res = abs(UV1 - UV2);

vec3 rawCenter = (Pos1 + Pos2) / 2;
vec3 center = rawCenter * TBN;
vec3 dir = normalize(cem_glPos);
vec3 dirTBN = normalize(cem_glPos * TBN);

if (ProjMat[3][0] == -1)
{
    center = vec3(-cem_glPos.xy + rawCenter.xy, rawCenter.z) * TBN;
    dir = vec3(0, 0, -1);
    dirTBN = normalize(dir * TBN);
}

float modelSize = length(Pos2 - Pos3);

float minT = MAX_DEPTH;
color = vec4(0);

if (cem_keep_original == 1)
{
    vec3 originalHitA = triIntersect(vec3(0), dir, Pos1, Pos2, Pos3);
    vec3 originalHitB = triIntersect(vec3(0), dir, Pos1, Pos2, Pos4);
    bool hitFirst = originalHitA.z <= originalHitB.z;
    vec3 originalHit = hitFirst ? originalHitA : originalHitB;
    if (originalHit.z < minT)
    {
        vec2 originalThirdUv = hitFirst ? UV3 : UV4;
        vec2 originalUv = UV1 + originalHit.x * (UV2 - UV1) + originalHit.y * (originalThirdUv - UV1);
        ivec2 originalPixel = clamp(ivec2(floor(originalUv)), ivec2(0), textureSize(Sampler0, 0) - 1);
        vec4 originalColor = cemTexelFetch(originalUv) * CEM_VERTEX_COLOR * ColorModulator;
        if (originalColor.a >= 0.1)
        {
            minT = originalHit.z;
            color = originalColor;
        }
    }
}
