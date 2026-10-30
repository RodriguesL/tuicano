// iTerm2's OSC 1337 inline image. PNG and JPEG both pass through as their own
// bytes — nothing is decoded or re-encoded here.
import type { Picture, Placement } from './types'

export function iterm2Image(pic: Picture, place: Placement, opts?: { name?: string }): string {
  const name = opts?.name ?? (pic.mime === 'image/jpeg' ? 'tucano.jpg' : 'tucano.png')
  // iTerm2 wants name base64'd too: it decodes it back into a display name.
  const params = `File=name=${Buffer.from(name).toString('base64')};size=${pic.bytes.length};inline=1;width=${place.cols};height=${place.rows};preserveAspectRatio=1`
  return `\x1b]1337;${params}:${Buffer.from(pic.bytes).toString('base64')}\x07`
}
