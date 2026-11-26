
export function imagePrompt(prompt, aspectRatio, scene = false) {
  return `${prompt.trim()}

Create one high-quality image in ${aspectRatio} composition.

VISUAL QUALITY:
Use realistic materials, professional product photography, coherent lighting, natural shadows and premium cinematic color grading.

SUBJECT CONSISTENCY:
Preserve the reference subject's exact shape, proportions, colors, materials, packaging, logo placement and identifying details.
Do not redesign, replace or distort the product.

COMPOSITION:
Keep the main subject clearly visible with believable scale and perspective.
Use a suitable camera angle, depth of field and background.
Avoid unrelated objects and visual clutter.

${scene ? 'Leave the bottom quarter uncluttered for captions. Do not add captions, text or promotional lettering.' : 'Do not add unrequested text, captions or promotional lettering.'}`;
}

export function videoPrompt(prompt, duration, aspectRatio) {
  return `${prompt.trim()}

VIDEO GENERATION INSTRUCTIONS:

Create a ${duration}-second cinematic video in ${aspectRatio} aspect ratio.

PRODUCT CONSISTENCY:
Preserve the exact appearance of the reference product throughout the entire video.
Maintain its original packaging, bottle shape, cap, label, colors, logo placement and proportions.
Do not redesign, replace, deform or duplicate the product.

MODEL CONSISTENCY:
If a person is present in the reference image, maintain the same face, hairstyle, clothing, body proportions and overall appearance throughout the video.

MOTION:
Use realistic human movement, natural hand gestures and physically believable interaction with the product.
Avoid sudden movements, unnatural transitions, flickering and object deformation.

CAMERA:
Use smooth cinematic camera movement, controlled focus and natural depth of field.
Use a professional advertising-film visual style.

LIGHTING:
Maintain consistent lighting, realistic reflections, natural shadows and premium color grading.

AUDIO:
Use scene-appropriate ambient sound only when supported.
Do not invent dialogue, narration or music.

RESTRICTIONS:
Do not add unrequested text, subtitles, watermarks, logos or promotional captions.
Do not change the product identity or introduce unrelated objects.`;
}
