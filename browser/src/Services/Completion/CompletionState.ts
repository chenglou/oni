/**
 * CompletionStore.ts
 */

import * as types from "vscode-languageserver-types"

export interface ICompletionState {
    enabled: boolean
    cursorInfo: ICursorInfo
    bufferInfo: ICompletionBufferInfo
    meetInfo: ICompletionMeetInfo
    completionResults: ICompletionResults
    lastCompletionInfo: ILastCompletionInfo
}

export interface ICompletionMeetInfo {
    meetLine: number
    meetPosition: number
    queryPosition: number
    meetBase: string
    shouldExpand: boolean
}

export const DefaultMeetInfo: ICompletionMeetInfo = {
    meetLine: -1,
    meetPosition: -1,
    queryPosition: -1,
    meetBase: "",
    shouldExpand: false,
}

export interface ICompletionBufferInfo {
    language: string
    filePath: string
}

export const DefaultCompletionBufferInfo: ICompletionBufferInfo = {
    language: null,
    filePath: null,
}

export interface ILastCompletionInfo {
    meetLine: number
    meetPosition: number
    completedText: string
}

export const DefaultLastCompletionInfo: ILastCompletionInfo = {
    meetLine: -1,
    meetPosition: -1,
    completedText: "",
}

export interface ICompletionResults {
    completions: types.CompletionItem[]
    meetLine: number
    meetPosition: number
}

export const DefaultCompletionResults: ICompletionResults = {
    completions: [],
    meetLine: -1,
    meetPosition: -1,
}

export interface ICursorInfo {
    line: number
    column: number
    lineContents: string
}

export const DefaultCursorInfo: ICursorInfo = {
    line: -1,
    column: -1,
    lineContents: "",
}

export const DefaultCompletionState: ICompletionState = {
    enabled: false,
    cursorInfo: DefaultCursorInfo,
    bufferInfo: DefaultCompletionBufferInfo,
    meetInfo: DefaultMeetInfo,
    completionResults: DefaultCompletionResults,
    lastCompletionInfo: DefaultLastCompletionInfo,
}
