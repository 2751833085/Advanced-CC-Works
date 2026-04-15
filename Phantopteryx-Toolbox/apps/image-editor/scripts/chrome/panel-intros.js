// Inserts English summary + usage at top of each tool flyout panel (after .pbar)

(function() {
  var INTROS = {
    'p-adjust': {
      summary: 'Global tone and color correction for the whole image.',
      usage: 'Drag sliders to preview; Apply commits, Reset restores defaults, × closes without leaving the dock tab.'
    },
    'p-detail': {
      summary: 'Structure, sharpening, and softening without changing overall color balance much.',
      usage: 'Adjust sliders while watching the canvas; Apply when satisfied.'
    },
    'p-tone': {
      summary: 'Targeted brightening or darkening by luminance range (high / mid / low).',
      usage: 'Use Protect sliders to limit clipping on highlights or shadows; Apply to commit.'
    },
    'p-curves': {
      summary: 'Fine control of contrast per channel by shaping a tone curve.',
      usage: 'Click the graph to add points, drag to move, right-click to remove; pick RGB or single channel; Apply to commit.'
    },
    'p-crop': {
      summary: 'Crop, rotate, and flip the image with optional aspect presets.',
      usage: 'Drag the crop box on the canvas; use ratio buttons or Free; Apply Crop commits.'
    },
    'p-persp': {
      summary: 'Perspective correction with tilt, rotate, scale, or free corner mode.',
      usage: 'Pick fill mode (Auto Fill uses the local AI server). Changes save automatically after a short pause — no Apply. Reset / Cancel as needed.'
    },
    'p-wb': {
      summary: 'White balance using temperature (warm/cool) and tint (green/magenta).',
      usage: 'Adjust until neutrals look correct; Apply to commit.'
    },
    'p-grayscale': {
      summary: 'Blends the image toward luminance-based grayscale.',
      usage: 'Mix 0% is original; raise Mix to preview, Apply to commit. Reset restores 0%.'
    },
    'p-vignette': {
      summary: 'Darkens or lightens the edges relative to the center.',
      usage: 'Strength controls amount, Feather controls how far inward it reaches; Apply to commit.'
    },
    'p-lensblur': {
      summary: 'Simulates shallow depth of field with radial blur falloff.',
      usage: 'Blur sets strength; Transition sets how quickly sharp center becomes blurred; Apply to commit.'
    },
    'p-glamour': {
      summary: 'Soft glow / glamour by blending a blurred layer.',
      usage: 'Increase Glow for stronger effect; Apply to commit.'
    },
    'p-tonalcontrast': {
      summary: 'Local contrast boost similar to clarity / structure emphasis.',
      usage: 'Amount increases edge contrast; Apply to commit.'
    },
    'p-hdr': {
      summary: 'HDR-style local tone mapping for extra punch.',
      usage: 'Strength controls intensity; Apply to commit.'
    },
    'p-drama': {
      summary: 'Strong stylized contrast and saturation shift.',
      usage: 'Strength controls look; Apply to commit.'
    },
    'p-vintage': {
      summary: 'Washed, aged photo look with lifted blacks and muted colors.',
      usage: 'Strength controls intensity; Apply to commit.'
    },
    'p-grain': {
      summary: 'Adds film-like grain noise.',
      usage: 'Grain amount; Apply to commit.'
    },
    'p-retrolux': {
      summary: 'Retro cross-process style with shifted tones.',
      usage: 'Strength controls intensity; Apply to commit.'
    },
    'p-noir': {
      summary: 'High-contrast black-and-white dramatic look.',
      usage: 'Contrast slider; Apply to commit.'
    },
    'p-bw': {
      summary: 'Channel-mixer style black and white using R/G/B weights.',
      usage: 'Balance the three sliders; Apply to commit.'
    },
    'p-frames': {
      summary: 'Adds a simple border frame around the image.',
      usage: 'Width sets border thickness; Apply to commit.'
    },
    'p-styleDither': {
      summary: 'Ordered (Bayer) dithering reduces banding when quantizing to few levels per channel.',
      usage: 'Mix 0% shows the original; raise Mix for the effect. Pick matrix size and levels; Apply commits.'
    },
    'p-styleDigitiles': {
      summary: 'Mosaic of solid color tiles (average color per cell), similar to low-res “pixel” looks.',
      usage: 'Mix 0% is off; raise Mix for the effect. Tile size, gap, sampling, saturation; Apply commits.'
    },
    'p-styleStipple': {
      summary: 'High-contrast halftone-like patterns: horizontal stripes or Benday-style cells.',
      usage: 'Turn On to preview; Off shows the original. Reset restores defaults and Off. Apply commits when On.'
    },
    'p-styleHalftone': {
      summary: 'AM halftone dots on a light “paper” background with rotatable screen angle.',
      usage: 'Mix 0% is off; raise Mix for the effect. Pitch, angle, weight, paper, dot gain; Apply commits.'
    },
    'p-brush': {
      summary: 'Paint exposure adjustments freehand on the canvas.',
      usage: 'Set brush size and exposure, then drag on the image; Apply to commit strokes.'
    },
    'p-selective': {
      summary: 'Circular local adjustments for brightness, contrast, and saturation.',
      usage: 'Tap the image to place a point, drag the ring; multiple points possible; Apply to commit.'
    },
    'p-heal': {
      summary: 'Clone-style healing: sample a clean area and paint over defects.',
      usage: 'Alt/Option+click source, then paint target; Apply to commit.'
    },
    'p-text': {
      summary: 'Raster text overlay placed by clicking the canvas.',
      usage: 'Type text, set size, click image to position; Apply to commit.'
    },
    'p-double': {
      summary: 'Blend a second image over the current image.',
      usage: 'Pick second image, set opacity, align if needed; Apply to commit.'
    },
    'p-expand': {
      summary: 'Expand canvas on any side with edge stretch, mirror, solid fill, or AI fill.',
      usage: 'Set padding sliders and fill mode; Apply AI Fill only when backend is configured; Apply to commit.'
    },
    'p-aienhance': {
      summary: 'AI-based enhancement (requires configured API).',
      usage: 'Strength 0 is off (no preview). Raise strength to preview; Apply runs the model. Reset clears strength.'
    },
    'p-aiexpand': {
      summary: 'Canvas expand with live server preview (edge fill): each debounced preview is saved; close the flyout when done.',
      usage: 'Checkerboard shows the work area. Adjust presets and Amount — previews commit automatically. **Reset** clears padding; **Cancel** / closing the flyout keeps the last saved canvas. Requires the local AI server for `/ai/expand` (preview uses `mode=edge`).'
    },
    'p-airemove': {
      summary: 'AI inpainting to remove an object (mask / region based per tool wiring).',
      usage: 'Follow tool steps; requires API.'
    },
    'p-aibg': {
      summary: 'AI background removal.',
      usage: 'Apply runs the model when configured. Reset clears any preview; switching tools no longer auto-runs the model.'
    },
    'p-aistyle': {
      summary: 'AI style transfer reference workflow.',
      usage: 'Strength 0 is off (no preview). Raise strength to preview; Apply commits. Reset restores defaults.'
    }
  };

  function inject() {
    var panels = document.getElementById('panels');
    if (!panels) return;
    Object.keys(INTROS).forEach(function(id) {
      var panel = document.getElementById(id);
      if (!panel || panel.querySelector('.tool-panel-intro')) return;
      var meta = INTROS[id];
      var bar = panel.querySelector('.pbar');
      var intro = document.createElement('div');
      intro.className = 'tool-panel-intro';
      intro.innerHTML =
        '<p class="tool-panel-intro-summary">' + meta.summary + '</p>' +
        '<p class="tool-panel-intro-usage">' + meta.usage + '</p>';
      if (bar && bar.nextSibling) {
        panel.insertBefore(intro, bar.nextSibling);
      } else if (bar) {
        panel.appendChild(intro);
      } else {
        panel.insertBefore(intro, panel.firstChild);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
