/**
 * Test scripts for QuickOpen
 */

import * as assert from "assert"

import { createNewFile, getCompletionElement } from "./Common"

export const test = async (oni: any) => {
    await createNewFile("css", oni)

    oni.automation.sendKeys("i")
    await oni.automation.sleep(500)
    oni.automation.sendKeys(".test { pos")

    // Wait for completion popup to show
    await oni.automation.waitFor(() => getCompletionElement() !== null)

    // Check for 'alert' as an available completion
    const completionElement = getCompletionElement()
    const textContent = completionElement.textContent

    assert.ok(textContent.indexOf("position") >= 0, "Verify 'position' was presented as a completion")
}
