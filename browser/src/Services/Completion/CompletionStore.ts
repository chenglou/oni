/**
 * CompletionStore.ts
 */

import * as types from "vscode-languageserver-types"

import "rxjs/add/operator/mergeMap"
import { Observable } from "rxjs/Observable"

import { combineReducers, Reducer, Store } from "redux"
import { combineEpics, createEpicMiddleware, Epic } from "redux-observable"

import { createStore as oniCreateStore } from "./../../Redux"

import { Configuration } from "./../Configuration"
import { LanguageManager } from "./../Language"

import { commitCompletion } from "./CompletionProvider"
import * as CompletionSelects from "./CompletionSelectors"
import { ICompletionsRequestor } from "./CompletionsRequestor"
import * as CompletionUtility from "./CompletionUtility"

import { DefaultCompletionResults, DefaultCompletionState, DefaultCursorInfo, DefaultLastCompletionInfo, DefaultMeetInfo, ICompletionBufferInfo, ICompletionMeetInfo, ICompletionResults, ICompletionState, ICursorInfo, ILastCompletionInfo } from "./CompletionState"

export type CompletionAction = {
    type: "CURSOR_MOVED",
    line: number,
    column: number
    lineContents: string,
} | {
        type: "MODE_CHANGED",
        mode: string,
    } | {
        type: "BUFFER_ENTER",
        language: string
        filePath: string,
    } | {
        type: "COMMIT_COMPLETION"
        meetBase: string
        meetLine: number
        meetPosition: number
        completionText: string,
    } | {
        type: "MEET_CHANGED",
        currentMeet: ICompletionMeetInfo,
    } | {
        type: "GET_COMPLETIONS_RESULT"
        meetLine: number
        meetPosition: number
        completions: types.CompletionItem[],
    } | {
        type: "GET_COMPLETION_ITEM_DETAILS",
        completionItem: types.CompletionItem,
    } | {
        type: "GET_COMPLETION_ITEM_DETAILS_RESULT"
        completionItemWithDetails: types.CompletionItem,
    }

const bufferInfoReducer: Reducer<ICompletionBufferInfo> = (
    state: ICompletionBufferInfo = {
        language: null,
        filePath: null,
    },
    action: CompletionAction,
) => {
    switch (action.type) {
        case "BUFFER_ENTER":
            return {
                language: action.language,
                filePath: action.filePath,
            }
        default:
            return state
    }
}

const meetInfoReducer: Reducer<ICompletionMeetInfo> = (
    state: ICompletionMeetInfo = DefaultMeetInfo,
    action: CompletionAction,
) => {
    switch (action.type) {
        case "MODE_CHANGED":
            return DefaultMeetInfo
        case "MEET_CHANGED":
            return {
                ...action.currentMeet,
            }
        default:
            return state
    }
}

export const completionResultsReducer: Reducer<ICompletionResults> = (
    state: ICompletionResults = DefaultCompletionResults,
    action: CompletionAction,
) => {
    switch (action.type) {
        case "MODE_CHANGED":
        case "BUFFER_ENTER":
            return DefaultCompletionResults
        case "GET_COMPLETIONS_RESULT":
            return {
                meetLine: action.meetLine,
                meetPosition: action.meetPosition,
                completions: action.completions,
            }
        case "GET_COMPLETION_ITEM_DETAILS_RESULT":
            return {
                ...state,
                completions: state.completions.map((completion) => {
                    if (completion.label === action.completionItemWithDetails.label) {
                        return action.completionItemWithDetails
                    } else {
                        return completion
                    }
                }),
            }
        default:
            return state
    }
}

export const cursorInfoReducer: Reducer<ICursorInfo> = (
    state: ICursorInfo = DefaultCursorInfo,
    action: CompletionAction,
) => {
    switch (action.type) {
        case "CURSOR_MOVED":
            return {
                line: action.line,
                lineContents: action.lineContents,
                column: action.column,
            }
        default:
            return state
    }
}

export const enabledReducer: Reducer<boolean> = (
    state: boolean = false,
    action: CompletionAction,
) => {
    switch (action.type) {
        case "MODE_CHANGED":
            return action.mode === "insert"
        default:
            return state
    }
}

export const lastCompletionInfoReducer: Reducer<ILastCompletionInfo> = (
    state: ILastCompletionInfo = DefaultLastCompletionInfo,
    action: CompletionAction,
) => {
    switch (action.type) {
        case "MODE_CHANGED":
        case "BUFFER_ENTER":
            return DefaultLastCompletionInfo
        case "COMMIT_COMPLETION":
            return {
                meetLine: action.meetLine,
                meetPosition: action.meetPosition,
                completedText: action.completionText,
            }
        default:
            return state
    }
}

const nullAction: CompletionAction = { type: null } as CompletionAction

const createGetCompletionMeetEpic = (languageManager: LanguageManager, configuration: Configuration): Epic<CompletionAction, ICompletionState> => (action$, store) =>
    action$.ofType("CURSOR_MOVED")
        .filter(() => configuration.getValue("editor.completions.mode") === "oni")
        .auditTime(10)
        .map((action: CompletionAction) => {
            const currentState: ICompletionState = store.getState()

            if (!currentState.enabled) {
                return nullAction
            }

            if (!currentState.bufferInfo || !currentState.bufferInfo.language) {
                return nullAction
            }

            if (!currentState.cursorInfo || !currentState.cursorInfo.lineContents) {
                return nullAction
            }

            const { bufferInfo } = currentState

            const token = languageManager.getTokenRegex(bufferInfo.language)
            const completionCharacters = languageManager.getCompletionTriggerCharacters(bufferInfo.language)

            const meet = CompletionUtility.getCompletionMeet(currentState.cursorInfo.lineContents, currentState.cursorInfo.column, token, completionCharacters)

            const meetForAction: ICompletionMeetInfo = {
                meetPosition: meet.position,
                meetLine: currentState.cursorInfo.line,
                queryPosition: meet.positionToQuery,
                meetBase: meet.base,
                shouldExpand: meet.shouldExpandCompletions,
            }

            return {
                type: "MEET_CHANGED",
                currentMeet: meetForAction,
            } as CompletionAction
        })

const commitCompletionEpic: Epic<CompletionAction, ICompletionState> = (action$, store) =>
    action$.ofType("COMMIT_COMPLETION")
        .do(async (action) => {
            if (action.type !== "COMMIT_COMPLETION") {
                return
            }

            await commitCompletion(action.meetLine, action.meetPosition, action.completionText)
        }).map(_ => nullAction)

const createGetCompletionsEpic = (completionsRequestor: ICompletionsRequestor): Epic<CompletionAction, ICompletionState> => (action$, store) =>
    action$.ofType("MEET_CHANGED")
        .filter(() => store.getState().enabled)
        .filter((action) => {
            const state = store.getState()

            if (action.type !== "MEET_CHANGED") {
                return false
            }

            if (!action.currentMeet.shouldExpand) {
                return false
            }

            if (action.currentMeet.meetLine === state.completionResults.meetLine
                && action.currentMeet.meetPosition === state.completionResults.meetPosition) {
                return false
            }

            return true
        })
        .switchMap((action: CompletionAction): Observable<CompletionAction> => {

            const state = store.getState()

            // Helper to let TypeScript know that we can assume this is 'MEET_CHANGED'...
            if (action.type !== "MEET_CHANGED") {
                return Observable.of(nullAction)
            }

            if (!state.enabled) {
                return Observable.of(nullAction)
            }

            // Check if the meet is different from the last meet we queried
            const requestResult: Observable<types.CompletionItem[]> = Observable.defer(async () => {
                const results = await completionsRequestor.getCompletions(state.bufferInfo.language, state.bufferInfo.filePath, action.currentMeet.meetLine, action.currentMeet.queryPosition)
                const completions = results || []
                const orderedCompletions = orderCompletions(completions, action.currentMeet.meetBase)
                return orderedCompletions
            })

            const ret = requestResult.map((completions) => {
                return {
                    type: "GET_COMPLETIONS_RESULT",
                    meetLine: action.currentMeet.meetLine,
                    meetPosition: action.currentMeet.meetPosition,
                    completions,
                } as CompletionAction
            })

            return ret
        })

export const orderCompletions = (completions: types.CompletionItem[], base: string): types.CompletionItem[] => {
    if (!completions || !completions.length) {
        return completions
    }

    const anyCompletionsMatchCurrentBase = completions.find((item) => CompletionUtility.getInsertText(item) === base)

    if (!anyCompletionsMatchCurrentBase) {
        return completions
    }

    const filteredCompletions = completions.filter((item) => item !== anyCompletionsMatchCurrentBase)

    const ret = [anyCompletionsMatchCurrentBase, ...filteredCompletions]
    return ret
}

const createGetCompletionDetailsEpic = (completionsRequestor: ICompletionsRequestor): Epic<CompletionAction, ICompletionState> => (action$, store) =>
    action$.ofType("GET_COMPLETION_ITEM_DETAILS")
        .switchMap((action) => {

            if (action.type !== "GET_COMPLETION_ITEM_DETAILS") {
                return Observable.of(nullAction)
            }

            return Observable.defer(async () => {
                const state = store.getState()

                const result = await completionsRequestor.getCompletionDetails(state.bufferInfo.language, state.bufferInfo.filePath, action.completionItem)
                return result
            }).map((itemResult: types.CompletionItem) => {
                if (itemResult) {
                    return {
                        type: "GET_COMPLETION_ITEM_DETAILS_RESULT",
                        completionItemWithDetails: itemResult,
                    } as CompletionAction
                } else {
                    return nullAction
                }
            })
        })

const selectFirstItemEpic: Epic<CompletionAction, ICompletionState> = (action$, store) =>
    action$.ofType("GET_COMPLETIONS_RESULT")
        .map((action) => {

            if (action.type !== "GET_COMPLETIONS_RESULT") {
                return nullAction
            }

            const state = store.getState()
            const filteredItems = CompletionSelects.filterCompletionOptions(action.completions, state.meetInfo.meetBase)

            if (!filteredItems || !filteredItems.length) {
                return nullAction
            }

            return {
                type: "GET_COMPLETION_ITEM_DETAILS",
                completionItem: filteredItems[0],
            } as CompletionAction

        })

export const createStore = (languageManager: LanguageManager, configuration: Configuration, completionsRequestor: ICompletionsRequestor): Store<ICompletionState> => {
    return oniCreateStore("COMPLETION_STORE",
        combineReducers<ICompletionState>({
            enabled: enabledReducer,
            bufferInfo: bufferInfoReducer,
            meetInfo: meetInfoReducer,
            completionResults: completionResultsReducer,
            lastCompletionInfo: lastCompletionInfoReducer,
            cursorInfo: cursorInfoReducer,
        }),
        DefaultCompletionState,
        [createEpicMiddleware(combineEpics(
            commitCompletionEpic,
            createGetCompletionMeetEpic(languageManager, configuration),
            createGetCompletionsEpic(completionsRequestor),
            createGetCompletionDetailsEpic(completionsRequestor),
            selectFirstItemEpic,
        ))],
    )
}
