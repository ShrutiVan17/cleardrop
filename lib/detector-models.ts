export const DETECTOR_MODELS = {
  owlvit: {name:'OWL-ViT baseline',id:'Xenova/owlvit-base-patch32',revision:'main',q8MB:155,fp32MB:612,threshold:.1},
  grounding: {name:'Grounding DINO Tiny',id:'onnx-community/grounding-dino-tiny-ONNX',revision:'ff690b0a8050566c290287545bd059350f3e9096',q8MB:204,fp32MB:719,threshold:.25},
} as const
export type DetectorModel = keyof typeof DETECTOR_MODELS
// Grounding DINO returns decoded phrases, while OWL-ViT returns exact prompts.
// Map only unambiguous aliases; never coerce a person/doormat into a package.
export function normalizeGroundedLabel(label:string):string {
  const phrase=label.toLowerCase().replace(/[.]/g,'').replace(/^a\s+/,'').replace(/\s+/g,' ').trim()
  const aliases:Record<string,string>={
    'cardboard box':'a cardboard box','box':'a cardboard box',
    'padded mailing envelope':'a padded mailing envelope','mailing envelope':'a padded mailing envelope',
    'plastic delivery parcel':'a plastic delivery parcel','delivery parcel':'a plastic delivery parcel',
  }
  return aliases[phrase] || label
}
