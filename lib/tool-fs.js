/*!
 * DSH Workspace Guard
 * Copyright (c) 2026 DSH Workspace Guard contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Third-party notices and licenses: THIRD_PARTY_LICENSES.txt
 */
import { m as defineTool } from "./lib-BDj20byz.js";
import { c as sandboxPermissionsDescription, i as approveEscalation, l as validateEscalationArgs, o as escalationHintMarker, s as sandboxDenialMarker, t as ESCALATION_TARGETS } from "./lib-DWBq_88x.js";
import "./runtime-version-C8e7Atkv.js";
import { basename, extname } from "node:path";
import z from "@deepseek-ai/schemastery";
import { FsError } from "@deepseek-ai/dsh-fs";
import { readLangHintForPath } from "@deepseek-ai/dsh-util-code-language";
import { AttachmentError, AttachmentId } from "@deepseek-ai/dsh-attachment";
// node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/base.js
var Diff = class {
	diff(oldStr, newStr, options = {}) {
		let callback;
		if (typeof options === "function") {
			callback = options;
			options = {};
		} else if ("callback" in options) callback = options.callback;
		const oldString = this.castInput(oldStr, options);
		const newString = this.castInput(newStr, options);
		const oldTokens = this.removeEmpty(this.tokenize(oldString, options));
		const newTokens = this.removeEmpty(this.tokenize(newString, options));
		return this.diffWithOptionsObj(oldTokens, newTokens, options, callback);
	}
	diffWithOptionsObj(oldTokens, newTokens, options, callback) {
		var _a;
		const done = (value) => {
			value = this.postProcess(value, options);
			if (callback) {
				setTimeout(function() {
					callback(value);
				}, 0);
				return;
			} else return value;
		};
		const newLen = newTokens.length, oldLen = oldTokens.length;
		let editLength = 1;
		let maxEditLength = newLen + oldLen;
		if (options.maxEditLength != null) maxEditLength = Math.min(maxEditLength, options.maxEditLength);
		const maxExecutionTime = (_a = options.timeout) !== null && _a !== void 0 ? _a : Infinity;
		const abortAfterTimestamp = Date.now() + maxExecutionTime;
		const bestPath = [{
			oldPos: -1,
			lastComponent: void 0
		}];
		let newPos = this.extractCommon(bestPath[0], newTokens, oldTokens, 0, options);
		if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) return done(this.buildValues(bestPath[0].lastComponent, newTokens, oldTokens));
		let minDiagonalToConsider = -Infinity, maxDiagonalToConsider = Infinity;
		const execEditLength = () => {
			for (let diagonalPath = Math.max(minDiagonalToConsider, -editLength); diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
				let basePath;
				const removePath = bestPath[diagonalPath - 1], addPath = bestPath[diagonalPath + 1];
				if (removePath) bestPath[diagonalPath - 1] = void 0;
				let canAdd = false;
				if (addPath) {
					const addPathNewPos = addPath.oldPos - diagonalPath;
					canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
				}
				const canRemove = removePath && removePath.oldPos + 1 < oldLen;
				if (!canAdd && !canRemove) {
					bestPath[diagonalPath] = void 0;
					continue;
				}
				if (!canRemove || canAdd && removePath.oldPos < addPath.oldPos) basePath = this.addToPath(addPath, true, false, 0, options);
				else basePath = this.addToPath(removePath, false, true, 1, options);
				newPos = this.extractCommon(basePath, newTokens, oldTokens, diagonalPath, options);
				if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) return done(this.buildValues(basePath.lastComponent, newTokens, oldTokens)) || true;
				else {
					bestPath[diagonalPath] = basePath;
					if (basePath.oldPos + 1 >= oldLen) maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
					if (newPos + 1 >= newLen) minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
				}
			}
			editLength++;
		};
		if (callback) (function exec() {
			setTimeout(function() {
				if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) return callback(void 0);
				if (!execEditLength()) exec();
			}, 0);
		})();
		else while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
			const ret = execEditLength();
			if (ret) return ret;
		}
	}
	addToPath(path, added, removed, oldPosInc, options) {
		const last = path.lastComponent;
		if (last && !options.oneChangePerToken && last.added === added && last.removed === removed) return {
			oldPos: path.oldPos + oldPosInc,
			lastComponent: {
				count: last.count + 1,
				added,
				removed,
				previousComponent: last.previousComponent
			}
		};
		else return {
			oldPos: path.oldPos + oldPosInc,
			lastComponent: {
				count: 1,
				added,
				removed,
				previousComponent: last
			}
		};
	}
	extractCommon(basePath, newTokens, oldTokens, diagonalPath, options) {
		const newLen = newTokens.length, oldLen = oldTokens.length;
		let oldPos = basePath.oldPos, newPos = oldPos - diagonalPath, commonCount = 0;
		while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(oldTokens[oldPos + 1], newTokens[newPos + 1], options)) {
			newPos++;
			oldPos++;
			commonCount++;
			if (options.oneChangePerToken) basePath.lastComponent = {
				count: 1,
				previousComponent: basePath.lastComponent,
				added: false,
				removed: false
			};
		}
		if (commonCount && !options.oneChangePerToken) basePath.lastComponent = {
			count: commonCount,
			previousComponent: basePath.lastComponent,
			added: false,
			removed: false
		};
		basePath.oldPos = oldPos;
		return newPos;
	}
	equals(left, right, options) {
		if (options.comparator) return options.comparator(left, right);
		else return left === right || !!options.ignoreCase && left.toLowerCase() === right.toLowerCase();
	}
	removeEmpty(array) {
		const ret = [];
		for (let i = 0; i < array.length; i++) if (array[i]) ret.push(array[i]);
		return ret;
	}
	castInput(value, options) {
		return value;
	}
	tokenize(value, options) {
		return Array.from(value);
	}
	join(chars) {
		return chars.join("");
	}
	postProcess(changeObjects, options) {
		return changeObjects;
	}
	get useLongestToken() {
		return false;
	}
	buildValues(lastComponent, newTokens, oldTokens) {
		const components = [];
		let nextComponent;
		while (lastComponent) {
			components.push(lastComponent);
			nextComponent = lastComponent.previousComponent;
			delete lastComponent.previousComponent;
			lastComponent = nextComponent;
		}
		components.reverse();
		const componentLen = components.length;
		let componentPos = 0, newPos = 0, oldPos = 0;
		for (; componentPos < componentLen; componentPos++) {
			const component = components[componentPos];
			if (!component.removed) {
				if (!component.added && this.useLongestToken) {
					let value = newTokens.slice(newPos, newPos + component.count);
					value = value.map(function(value, i) {
						const oldValue = oldTokens[oldPos + i];
						return oldValue.length > value.length ? oldValue : value;
					});
					component.value = this.join(value);
				} else component.value = this.join(newTokens.slice(newPos, newPos + component.count));
				newPos += component.count;
				if (!component.added) oldPos += component.count;
			} else {
				component.value = this.join(oldTokens.slice(oldPos, oldPos + component.count));
				oldPos += component.count;
			}
		}
		return components;
	}
};
// node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/character.js
var CharacterDiff = class extends Diff {};
new CharacterDiff();
// node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/util/string.js
function longestCommonPrefix(str1, str2) {
	let i = 0;
	for (; i < str1.length && i < str2.length; i++) if (str1[i] != str2[i]) return str1.slice(0, i);
	return str1.slice(0, i);
}
function longestCommonSuffix(str1, str2) {
	let i;
	if (!str1 || !str2 || str1[str1.length - 1] != str2[str2.length - 1]) return "";
	for (i = 0; i < str1.length && i < str2.length; i++) if (str1[str1.length - (i + 1)] != str2[str2.length - (i + 1)]) return str1.slice(-i);
	return str1.slice(-i);
}
function replacePrefix(string, oldPrefix, newPrefix) {
	if (string.slice(0, oldPrefix.length) != oldPrefix) throw Error(`string ${JSON.stringify(string)} doesn't start with prefix ${JSON.stringify(oldPrefix)}; this is a bug`);
	return newPrefix + string.slice(oldPrefix.length);
}
function replaceSuffix(string, oldSuffix, newSuffix) {
	if (!oldSuffix) return string + newSuffix;
	if (string.slice(-oldSuffix.length) != oldSuffix) throw Error(`string ${JSON.stringify(string)} doesn't end with suffix ${JSON.stringify(oldSuffix)}; this is a bug`);
	return string.slice(0, -oldSuffix.length) + newSuffix;
}
function removePrefix(string, oldPrefix) {
	return replacePrefix(string, oldPrefix, "");
}
function removeSuffix(string, oldSuffix) {
	return replaceSuffix(string, oldSuffix, "");
}
function maximumOverlap(string1, string2) {
	return string2.slice(0, overlapCount(string1, string2));
}
function overlapCount(a, b) {
	let startA = 0;
	if (a.length > b.length) startA = a.length - b.length;
	let endB = b.length;
	if (a.length < b.length) endB = a.length;
	const map = Array(endB);
	let k = 0;
	map[0] = 0;
	for (let j = 1; j < endB; j++) {
		if (b[j] == b[k]) map[j] = map[k];
		else map[j] = k;
		while (k > 0 && b[j] != b[k]) k = map[k];
		if (b[j] == b[k]) k++;
	}
	k = 0;
	for (let i = startA; i < a.length; i++) {
		while (k > 0 && a[i] != b[k]) k = map[k];
		if (a[i] == b[k]) k++;
	}
	return k;
}
/**
* Split a string into segments using a word segmenter, merging consecutive
* segments if they are both whitespace segments. Whitespace segments can
* appear adjacent to one another for two reasons:
* - newlines always get their own segment
* - where a diacritic is attached to a whitespace character in the text, the
*   segment ends after the diacritic, so e.g. " \u0300 " becomes two segments.
* This function therefore runs the segmenter's .segment() method and then
* merges consecutive segments of whitespace into a single part.
*/
function segment(string, segmenter) {
	const parts = [];
	for (const segmentObj of Array.from(segmenter.segment(string))) {
		const segment = segmentObj.segment;
		if (parts.length && /\s/.test(parts[parts.length - 1]) && /\s/.test(segment)) parts[parts.length - 1] += segment;
		else parts.push(segment);
	}
	return parts;
}
function trailingWs(string, segmenter) {
	if (segmenter) return leadingAndTrailingWs(string, segmenter)[1];
	let i;
	for (i = string.length - 1; i >= 0; i--) if (!string[i].match(/\s/)) break;
	return string.substring(i + 1);
}
function leadingWs(string, segmenter) {
	if (segmenter) return leadingAndTrailingWs(string, segmenter)[0];
	const match = string.match(/^\s*/);
	return match ? match[0] : "";
}
function leadingAndTrailingWs(string, segmenter) {
	if (!segmenter) return [leadingWs(string), trailingWs(string)];
	if (segmenter.resolvedOptions().granularity != "word") throw new Error("The segmenter passed must have a granularity of \"word\"");
	const segments = segment(string, segmenter);
	const firstSeg = segments[0];
	const lastSeg = segments[segments.length - 1];
	return [/\s/.test(firstSeg) ? firstSeg : "", /\s/.test(lastSeg) ? lastSeg : ""];
}
// node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/word.js
const extendedWordChars = "a-zA-Z0-9_\\u{AD}\\u{C0}-\\u{D6}\\u{D8}-\\u{F6}\\u{F8}-\\u{2C6}\\u{2C8}-\\u{2D7}\\u{2DE}-\\u{2FF}\\u{1E00}-\\u{1EFF}";
const tokenizeIncludingWhitespace = new RegExp(`[${extendedWordChars}]+|\\s+|[^${extendedWordChars}]`, "ug");
var WordDiff = class extends Diff {
	equals(left, right, options) {
		if (options.ignoreCase) {
			left = left.toLowerCase();
			right = right.toLowerCase();
		}
		return left.trim() === right.trim();
	}
	tokenize(value, options = {}) {
		let parts;
		if (options.intlSegmenter) {
			const segmenter = options.intlSegmenter;
			if (segmenter.resolvedOptions().granularity != "word") throw new Error("The segmenter passed must have a granularity of \"word\"");
			parts = segment(value, segmenter);
		} else parts = value.match(tokenizeIncludingWhitespace) || [];
		const tokens = [];
		let prevPart = null;
		parts.forEach((part) => {
			if (/\s/.test(part)) {
				if (prevPart == null) tokens.push(part);
				else tokens.push(tokens.pop() + part);
			} else if (prevPart != null && /\s/.test(prevPart)) {
				if (tokens[tokens.length - 1] == prevPart) tokens.push(tokens.pop() + part);
				else tokens.push(prevPart + part);
			} else tokens.push(part);
			prevPart = part;
		});
		return tokens;
	}
	join(tokens) {
		return tokens.map((token, i) => {
			if (i == 0) return token;
			else return token.replace(/^\s+/, "");
		}).join("");
	}
	postProcess(changes, options) {
		if (!changes || options.oneChangePerToken) return changes;
		let lastKeep = null;
		let insertion = null;
		let deletion = null;
		changes.forEach((change) => {
			if (change.added) insertion = change;
			else if (change.removed) deletion = change;
			else {
				if (insertion || deletion) dedupeWhitespaceInChangeObjects(lastKeep, deletion, insertion, change, options.intlSegmenter);
				lastKeep = change;
				insertion = null;
				deletion = null;
			}
		});
		if (insertion || deletion) dedupeWhitespaceInChangeObjects(lastKeep, deletion, insertion, null, options.intlSegmenter);
		return changes;
	}
};
new WordDiff();
function dedupeWhitespaceInChangeObjects(startKeep, deletion, insertion, endKeep, segmenter) {
	if (deletion && insertion) {
		const [oldWsPrefix, oldWsSuffix] = leadingAndTrailingWs(deletion.value, segmenter);
		const [newWsPrefix, newWsSuffix] = leadingAndTrailingWs(insertion.value, segmenter);
		if (startKeep) {
			const commonWsPrefix = longestCommonPrefix(oldWsPrefix, newWsPrefix);
			startKeep.value = replaceSuffix(startKeep.value, newWsPrefix, commonWsPrefix);
			deletion.value = removePrefix(deletion.value, commonWsPrefix);
			insertion.value = removePrefix(insertion.value, commonWsPrefix);
		}
		if (endKeep) {
			const commonWsSuffix = longestCommonSuffix(oldWsSuffix, newWsSuffix);
			endKeep.value = replacePrefix(endKeep.value, newWsSuffix, commonWsSuffix);
			deletion.value = removeSuffix(deletion.value, commonWsSuffix);
			insertion.value = removeSuffix(insertion.value, commonWsSuffix);
		}
	} else if (insertion) {
		if (startKeep) {
			const ws = leadingWs(insertion.value, segmenter);
			insertion.value = insertion.value.substring(ws.length);
		}
		if (endKeep) {
			const ws = leadingWs(endKeep.value, segmenter);
			endKeep.value = endKeep.value.substring(ws.length);
		}
	} else if (startKeep && endKeep) {
		const newWsFull = leadingWs(endKeep.value, segmenter), [delWsStart, delWsEnd] = leadingAndTrailingWs(deletion.value, segmenter);
		const newWsStart = longestCommonPrefix(newWsFull, delWsStart);
		deletion.value = removePrefix(deletion.value, newWsStart);
		const newWsEnd = longestCommonSuffix(removePrefix(newWsFull, newWsStart), delWsEnd);
		deletion.value = removeSuffix(deletion.value, newWsEnd);
		endKeep.value = replacePrefix(endKeep.value, newWsFull, newWsEnd);
		startKeep.value = replaceSuffix(startKeep.value, newWsFull, newWsFull.slice(0, newWsFull.length - newWsEnd.length));
	} else if (endKeep) {
		const endKeepWsPrefix = leadingWs(endKeep.value, segmenter);
		const overlap = maximumOverlap(trailingWs(deletion.value, segmenter), endKeepWsPrefix);
		deletion.value = removeSuffix(deletion.value, overlap);
	} else if (startKeep) {
		const overlap = maximumOverlap(trailingWs(startKeep.value, segmenter), leadingWs(deletion.value, segmenter));
		deletion.value = removePrefix(deletion.value, overlap);
	}
}
var WordsWithSpaceDiff = class extends Diff {
	tokenize(value) {
		const regex = new RegExp(`(\\r?\\n)|[${extendedWordChars}]+|[^\\S\\n\\r]+|[^${extendedWordChars}]`, "ug");
		return value.match(regex) || [];
	}
};
new WordsWithSpaceDiff();
// node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/line.js
var LineDiff = class extends Diff {
	constructor() {
		super(...arguments);
		this.tokenize = tokenize;
	}
	equals(left, right, options) {
		if (options.ignoreWhitespace) {
			if (!options.newlineIsToken || !left.includes("\n")) left = left.trim();
			if (!options.newlineIsToken || !right.includes("\n")) right = right.trim();
		} else if (options.ignoreNewlineAtEof && !options.newlineIsToken) {
			if (left.endsWith("\n")) left = left.slice(0, -1);
			if (right.endsWith("\n")) right = right.slice(0, -1);
		}
		return super.equals(left, right, options);
	}
};
const lineDiff = new LineDiff();
function diffLines(oldStr, newStr, options) {
	return lineDiff.diff(oldStr, newStr, options);
}
function tokenize(value, options) {
	if (options.stripTrailingCr) value = value.replace(/\r\n/g, "\n");
	const retLines = [], linesAndNewlines = value.split(/(\n|\r\n)/);
	if (!linesAndNewlines[linesAndNewlines.length - 1]) linesAndNewlines.pop();
	for (let i = 0; i < linesAndNewlines.length; i++) {
		const line = linesAndNewlines[i];
		if (i % 2 && !options.newlineIsToken) retLines[retLines.length - 1] += line;
		else retLines.push(line);
	}
	return retLines;
}
// node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/sentence.js
function isSentenceEndPunct(char) {
	return char == "." || char == "!" || char == "?";
}
var SentenceDiff = class extends Diff {
	tokenize(value) {
		var _a;
		const result = [];
		let tokenStartI = 0;
		for (let i = 0; i < value.length; i++) {
			if (i == value.length - 1) {
				result.push(value.slice(tokenStartI));
				break;
			}
			if (isSentenceEndPunct(value[i]) && value[i + 1].match(/\s/)) {
				result.push(value.slice(tokenStartI, i + 1));
				i = tokenStartI = i + 1;
				while ((_a = value[i + 1]) === null || _a === void 0 ? void 0 : _a.match(/\s/)) i++;
				result.push(value.slice(tokenStartI, i + 1));
				tokenStartI = i + 1;
			}
		}
		return result;
	}
};
new SentenceDiff();
// node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/css.js
var CssDiff = class extends Diff {
	tokenize(value) {
		return value.split(/([{}:;,]|\s+)/);
	}
};
new CssDiff();
// node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/json.js
var JsonDiff = class extends Diff {
	constructor() {
		super(...arguments);
		this.tokenize = tokenize;
	}
	get useLongestToken() {
		return true;
	}
	castInput(value, options) {
		const { undefinedReplacement, stringifyReplacer = (k, v) => typeof v === "undefined" ? undefinedReplacement : v } = options;
		return typeof value === "string" ? value : JSON.stringify(canonicalize(value, null, null, stringifyReplacer), null, "  ");
	}
	equals(left, right, options) {
		return super.equals(left.replace(/,([\r\n])/g, "$1"), right.replace(/,([\r\n])/g, "$1"), options);
	}
};
new JsonDiff();
function canonicalize(obj, stack, replacementStack, replacer, key) {
	stack = stack || [];
	replacementStack = replacementStack || [];
	if (replacer) obj = replacer(key === void 0 ? "" : key, obj);
	let i = 0;
	for (; i < stack.length; i += 1) if (stack[i] === obj) return replacementStack[i];
	let canonicalizedObj;
	if ("[object Array]" === Object.prototype.toString.call(obj)) {
		stack.push(obj);
		canonicalizedObj = new Array(obj.length);
		replacementStack.push(canonicalizedObj);
		for (i = 0; i < obj.length; i += 1) canonicalizedObj[i] = canonicalize(obj[i], stack, replacementStack, replacer, String(i));
		stack.pop();
		replacementStack.pop();
		return canonicalizedObj;
	}
	if (obj && obj.toJSON) obj = obj.toJSON();
	if (typeof obj === "object" && obj !== null) {
		stack.push(obj);
		canonicalizedObj = {};
		replacementStack.push(canonicalizedObj);
		const sortedKeys = [];
		let key;
		for (key in obj)
 /* istanbul ignore else */
		if (Object.prototype.hasOwnProperty.call(obj, key)) sortedKeys.push(key);
		sortedKeys.sort();
		for (i = 0; i < sortedKeys.length; i += 1) {
			key = sortedKeys[i];
			canonicalizedObj[key] = canonicalize(obj[key], stack, replacementStack, replacer, key);
		}
		stack.pop();
		replacementStack.pop();
	} else canonicalizedObj = obj;
	return canonicalizedObj;
}
// node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/diff/array.js
var ArrayDiff = class extends Diff {
	tokenize(value) {
		return value.slice();
	}
	join(value) {
		return value;
	}
	removeEmpty(value) {
		return value;
	}
};
new ArrayDiff();
// node_modules/.pnpm/diff@9.0.0/node_modules/diff/libesm/patch/create.js
function structuredPatch(oldFileName, newFileName, oldStr, newStr, oldHeader, newHeader, options) {
	let optionsObj;
	if (!options) optionsObj = {};
	else if (typeof options === "function") optionsObj = { callback: options };
	else optionsObj = options;
	if (typeof optionsObj.context === "undefined") optionsObj.context = 4;
	const context = optionsObj.context;
	if (optionsObj.newlineIsToken) throw new Error("newlineIsToken may not be used with patch-generation functions, only with diffing functions");
	if (!optionsObj.callback) return diffLinesResultToPatch(diffLines(oldStr, newStr, optionsObj));
	else {
		const { callback } = optionsObj;
		diffLines(oldStr, newStr, Object.assign(Object.assign({}, optionsObj), { callback: (diff) => {
			const patch = diffLinesResultToPatch(diff);
			callback(patch);
		} }));
	}
	function diffLinesResultToPatch(diff) {
		if (!diff) return;
		diff.push({
			value: "",
			lines: []
		});
		function contextLines(lines) {
			return lines.map(function(entry) {
				return " " + entry;
			});
		}
		const hunks = [];
		let oldRangeStart = 0, newRangeStart = 0, curRange = [], oldLine = 1, newLine = 1;
		for (let i = 0; i < diff.length; i++) {
			const current = diff[i], lines = current.lines || splitLines(current.value);
			current.lines = lines;
			if (current.added || current.removed) {
				if (!oldRangeStart) {
					const prev = diff[i - 1];
					oldRangeStart = oldLine;
					newRangeStart = newLine;
					if (prev) {
						curRange = context > 0 ? contextLines(prev.lines.slice(-context)) : [];
						oldRangeStart -= curRange.length;
						newRangeStart -= curRange.length;
					}
				}
				for (const line of lines) curRange.push((current.added ? "+" : "-") + line);
				if (current.added) newLine += lines.length;
				else oldLine += lines.length;
			} else {
				if (oldRangeStart) {
					if (lines.length <= context * 2 && i < diff.length - 2) for (const line of contextLines(lines)) curRange.push(line);
					else {
						const contextSize = Math.min(lines.length, context);
						for (const line of contextLines(lines.slice(0, contextSize))) curRange.push(line);
						const hunk = {
							oldStart: oldRangeStart,
							oldLines: oldLine - oldRangeStart + contextSize,
							newStart: newRangeStart,
							newLines: newLine - newRangeStart + contextSize,
							lines: curRange
						};
						hunks.push(hunk);
						oldRangeStart = 0;
						newRangeStart = 0;
						curRange = [];
					}
				}
				oldLine += lines.length;
				newLine += lines.length;
			}
		}
		for (const hunk of hunks) for (let i = 0; i < hunk.lines.length; i++) if (hunk.lines[i].endsWith("\n")) hunk.lines[i] = hunk.lines[i].slice(0, -1);
		else {
			hunk.lines.splice(i + 1, 0, "\\ No newline at end of file");
			i++;
		}
		return {
			oldFileName,
			newFileName,
			oldHeader,
			newHeader,
			hunks
		};
	}
}
/**
* Split `text` into an array of lines, including the trailing newline character (where present)
*/
function splitLines(text) {
	const hasTrailingNl = text.endsWith("\n");
	const result = text.split("\n").map((line) => line + "\n");
	if (hasTrailingNl) result.pop();
	else result.push(result.pop().slice(0, -1));
	return result;
}
// node_modules/.pnpm/@deepseek-ai+dsh-tool-fs@0._0478a24ca4f13e33fc01041a578db98a/node_modules/@deepseek-ai/dsh-tool-fs/lib/index.js
/**
* Pure read presentation: turn provider-decoded text into a bounded, line-numbered window and
* model-facing envelope. Chunk scanning caps the current line, so even one newline-free giant
* line cannot grow memory without bound.
* @module @deepseek-ai/dsh-tool-fs/read-render
*/
/** Default maximum characters returned for a single line (the `readMaxLineLength` config). */
const READ_MAX_LINE_LENGTH = 1e4;
/** Default maximum bytes returned for selected file lines (the `readMaxBytes` config). */
const READ_MAX_BYTES = 1048576;
function newAccumulator() {
	return {
		lines: [],
		totalLines: 0,
		outputBytes: 0,
		truncatedByBytes: false
	};
}
function truncateLine(line, maxLineLength) {
	return line.length > maxLineLength ? `${line.substring(0, maxLineLength)}... (line truncated to ${maxLineLength} chars)` : line;
}
function lineByteSize(line, currentLineCount) {
	return Buffer.byteLength(line, "utf8") + (currentLineCount > 0 ? 1 : 0);
}
function consumeLine(acc, rawLine, request) {
	acc.totalLines += 1;
	if (acc.truncatedByBytes || acc.totalLines < request.offset || acc.lines.length >= request.limit) return;
	const text = truncateLine(rawLine, request.maxLineLength);
	const bytes = lineByteSize(text, acc.lines.length);
	if (acc.outputBytes + bytes > request.maxBytes) {
		acc.truncatedByBytes = true;
		return;
	}
	acc.outputBytes += bytes;
	acc.lines.push({
		number: acc.totalLines,
		text
	});
}
function stripCarriageReturn(line) {
	return line.endsWith("\r") ? line.slice(0, -1) : line;
}
function finish(acc, request, displayPath) {
	if (!acc.truncatedByBytes && request.offset > acc.totalLines && !(acc.totalLines === 0 && request.offset === 1)) throw new FsError(`offset ${request.offset} is out of range for "${displayPath}" (${acc.totalLines} lines)`, "FS_NOT_FOUND");
	return {
		lines: acc.lines,
		totalLines: acc.totalLines,
		truncatedByBytes: acc.truncatedByBytes
	};
}
/**
* Build one window from streamed or whole-file chunks, enforcing line and byte caps while still
* scanning to an exact total line count, and throwing `FS_NOT_FOUND` when the requested offset is
* past EOF.
* @param chunks - decoded text chunks in file order; chunk boundaries carry no meaning.
* @param request - the resolved window; the caller has already applied its defaults and caps.
* @param displayPath - the caller-facing path used in the offset-out-of-range error.
* @returns the numbered window lines, the total line count seen, and the byte-cap truncation flag.
*/
async function buildWindow(chunks, request, displayPath) {
	const acc = newAccumulator();
	const lineBufferCap = request.maxLineLength + 1;
	let lineBuffer = "";
	function appendToLineBuffer(segment) {
		if (lineBuffer.length >= lineBufferCap) return;
		lineBuffer += segment;
		if (lineBuffer.length > lineBufferCap) lineBuffer = lineBuffer.slice(0, lineBufferCap);
	}
	function flushLine() {
		consumeLine(acc, stripCarriageReturn(lineBuffer), request);
		lineBuffer = "";
	}
	for await (const chunk of chunks) {
		let startPos = 0;
		let newlinePos;
		while ((newlinePos = chunk.indexOf("\n", startPos)) !== -1) {
			appendToLineBuffer(chunk.slice(startPos, newlinePos));
			flushLine();
			startPos = newlinePos + 1;
		}
		appendToLineBuffer(chunk.slice(startPos));
	}
	if (lineBuffer.length > 0) flushLine();
	return finish(acc, request, displayPath);
}
/**
* Format a read outcome as one OpenCode-style line-numbered text block body.
* @param displayPath - the backend-resolved path rendered in the envelope's `<path>` element.
* @param outcome - the windowed read to render.
* @returns the model-facing envelope: numbered lines plus a continuation or end-of-file footer.
*/
function formatReadOutput(displayPath, outcome) {
	const endLine = outcome.lines.at(-1)?.number ?? Math.max(0, outcome.offset - 1);
	let footer;
	if (outcome.truncatedByBytes) footer = `(Output capped. Showing lines ${outcome.offset}-${endLine}. Use offset=${endLine + 1} to continue.)`;
	else if (endLine < outcome.totalLines) footer = `(Showing lines ${outcome.offset}-${endLine} of ${outcome.totalLines}. Use offset=${endLine + 1} to continue.)`;
	else footer = `(End of file - total ${outcome.totalLines} lines)`;
	return `<path>${displayPath}</path>
<type>file</type>
<content>
${outcome.lines.length > 0 ? `${outcome.lines.map((line) => `${line.number}: ${line.text}`).join("\n")}\n\n${footer}` : footer}
</content>`;
}
/**
* Whether `value` is a valid {@link FileTextLine} (defensive narrowing from
* opaque `meta`). `number` must be a 1-based integer line number, since a card
* rendered from a zero, fractional, or non-finite line number would violate the
* 1-based numbering contract the read window promises.
*/
function isFileTextLine(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const { number, text } = value;
	return typeof number === "number" && Number.isInteger(number) && number >= 1 && typeof text === "string";
}
/**
* Narrow opaque live or replayed result metadata to a structured read window.
* Malformed metadata returns `undefined` so presentation can fall back to the
* generic text card instead of throwing during replay. Beyond shape, the
* semantic contract of a read window is enforced against replayed JSON that is
* well-typed but out of range: `offset` must be a 1-based integer, `totalLines`
* must be a non-negative integer, each line number must be a 1-based integer no
* less than `offset`, the line numbers must strictly increase, and no line number
* may exceed `totalLines`. Any violation declines to the generic fallback rather
* than emitting a card that misnumbers or overcounts.
* @param meta - result metadata.
* @returns the validated read window, or `undefined` for absent, malformed, or semantically invalid data.
*/
function readMetaFromMeta(meta) {
	if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return void 0;
	const { path, offset, lines, totalLines, lang } = meta;
	if (typeof path !== "string" || typeof totalLines !== "number" || typeof offset !== "number") return void 0;
	if (!Number.isInteger(offset) || offset < 1) return void 0;
	if (!Number.isInteger(totalLines) || totalLines < 0) return void 0;
	if (!Array.isArray(lines) || !lines.every(isFileTextLine)) return void 0;
	if (lang !== void 0 && typeof lang !== "string") return void 0;
	let previous = offset - 1;
	for (const { number } of lines) {
		if (number <= previous || number > totalLines) return void 0;
		previous = number;
	}
	return {
		path,
		offset,
		lines,
		totalLines,
		...lang === void 0 ? {} : { lang }
	};
}
/**
* Resolution options for filesystem calls in the Session's current directory.
* Non-agent calls leave directory defaults to the filesystem provider.
* @module @deepseek-ai/dsh-tool-fs/session-cwd
*/
/**
* Resolve the current directory and cancellation for a filesystem call.
* @param ctx - context containing the working-directory service.
* @param exec - tool execution supplying the agent and cancellation.
* @returns filesystem resolution options for this call.
*/
async function sessionResolveOptions(ctx, exec) {
	const cwd = exec.agent === void 0 ? void 0 : await ctx.workingDirectory.ensure(exec.agent, exec.signal);
	return {
		...cwd !== void 0 ? { cwd } : {},
		signal: exec.signal
	};
}
/**
* Shared path resolution and regular-file validation for model-facing read tools.
* @module @deepseek-ai/dsh-tool-fs/src/read-target
*/
/**
* Resolve a model-supplied path, observe absence, and require a regular file.
* @param ctx - the plugin context providing filesystem resolution and observation events.
* @param exec - the current tool execution, including the owning Agent and cancellation.
* @param requestedPath - the raw path supplied to the tool.
* @returns the resolved target and its single stat result.
*/
async function resolveRegularReadTarget(ctx, exec, requestedPath) {
	const target = await ctx.fs.resolve(requestedPath, await sessionResolveOptions(ctx, exec));
	const info = await ctx.fs.stat(target, exec.signal);
	if (info === void 0) {
		ctx.emit("fs/observed", target, { kind: "absent" }, exec);
		throw new FsError(`cannot read "${target.displayPath}": not found`, "FS_NOT_FOUND");
	}
	if (info.type !== "file") throw new FsError(`cannot read "${target.displayPath}": not a regular file`, "FS_NOT_REGULAR_FILE");
	return {
		target,
		info
	};
}
/**
* Model-facing UTF-8 read. It performs one provider stat for type, routing, and observed version,
* streams large or size-unknown files, renders a bounded window, then emits the observation.
* @module @deepseek-ai/dsh-tool-fs/src/read
*/
/** Default and maximum number of lines returned by one `read` call (the `readLimit` config). */
const READ_LIMIT = 2e4;
/**
* Default streaming threshold (the `readStreamMinSize` config): files at or
* above this size stream; smaller files read whole into memory.
*/
const STREAM_MIN_SIZE = 10485760;
function parsePositiveInteger(value, name) {
	if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
	return value;
}
/**
* Validate value constraints the schema DSL can't express. `maxLimit` is the deployment's line cap.
* @param args - the schema-validated raw tool arguments; `offset`/`limit` must be positive integers when given.
* @param maxLimit - the configured line cap: both the default `limit` and the largest one accepted.
* @returns the validated input with `offset` defaulted to 1 and `limit` to `maxLimit`.
*/
function parseReadArgs(args, maxLimit) {
	if (args.file_path.trim().length === 0) throw new Error("file_path must be a non-empty string");
	const offset = args.offset === void 0 ? 1 : parsePositiveInteger(args.offset, "offset");
	const limit = args.limit === void 0 ? maxLimit : parsePositiveInteger(args.limit, "limit");
	if (limit > maxLimit) throw new Error(`limit must be less than or equal to ${maxLimit}`);
	return {
		filePath: args.file_path,
		offset,
		limit
	};
}
/**
* Register the `read` tool and its scope-aware system-prompt guidance.
* @param ctx - the plugin context; registrations are effects scoped to it, and execution uses its `fs` service.
* @param caps - the deployment's resolved read caps (plugin config after defaulting).
*/
function applyReadTool(ctx, caps) {
	ctx.systemPrompt.section({
		name: "tool:read",
		order: ctx.systemPrompt.getSectionOrder("TOOL_READ"),
		text: ({ scope }) => ctx.tools.get("read", scope) === void 0 ? "" : "Use the read tool — not shell commands like cat — to inspect text files. Use offset and limit to continue reading large files."
	});
	ctx.tools.register(defineTool({
		name: "read",
		description: "Read a UTF-8 text file and return line-numbered content.",
		parameters: {
			file_path: {
				type: "string",
				required: true,
				description: "Path to read, resolved by the filesystem backend."
			},
			offset: {
				type: "number",
				description: "1-based first line to return. Defaults to 1."
			},
			limit: {
				type: "number",
				description: `Maximum number of lines to return. Defaults to ${caps.limit}.`
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					path: {
						type: "string",
						required: true,
						description: "Canonical absolute path in the filesystem execution world."
					},
					offset: {
						type: "integer",
						required: true
					},
					lines: {
						type: "array",
						required: true,
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								number: {
									type: "integer",
									required: true
								},
								text: {
									type: "string",
									required: true
								}
							}
						}
					},
					totalLines: {
						type: "integer",
						required: true
					}
				}
			},
			render: (args, value) => {
				const input = parseReadArgs(args, caps.limit);
				const endLine = value.lines.at(-1)?.number ?? Math.max(0, value.offset - 1);
				const truncatedByBytes = value.lines.length < input.limit && endLine < value.totalLines;
				return [{
					type: "text",
					text: formatReadOutput(value.path, {
						offset: value.offset,
						lines: value.lines,
						totalLines: value.totalLines,
						...truncatedByBytes ? { truncatedByBytes: true } : {}
					})
				}];
			},
			presentationMeta: (_args, value) => {
				const lang = readLangHintForPath(value.path);
				return {
					path: value.path,
					offset: value.offset,
					lines: value.lines.map(({ number, text }) => ({
						number,
						text
					})),
					totalLines: value.totalLines,
					...lang === void 0 ? {} : { lang }
				};
			}
		},
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			const input = parseReadArgs(args, caps.limit);
			const { target, info } = await resolveRegularReadTarget(ctx, exec, input.filePath);
			const window = await buildWindow(info.size === void 0 || info.size >= caps.streamMinSize ? await ctx.fs.streamText(target, exec.signal) : [await ctx.fs.readText(target, exec.signal)], {
				offset: input.offset,
				limit: input.limit,
				maxLineLength: caps.maxLineLength,
				maxBytes: caps.maxBytes
			}, target.displayPath);
			const outcome = {
				path: ctx.fs.processPath(target),
				offset: input.offset,
				lines: window.lines,
				totalLines: window.totalLines
			};
			ctx.emit("fs/observed", target, {
				kind: "present",
				version: info.version
			}, exec);
			return outcome;
		},
		presentResult(_args, result) {
			if (result.isError) return void 0;
			const meta = readMetaFromMeta(result.meta);
			if (meta === void 0) return void 0;
			const only = result.content.length === 1 ? result.content[0] : void 0;
			const text = only?.type === "text" ? only.text : void 0;
			if (text === void 0) return void 0;
			const body = /^<path>[^\n]*<\/path>\n<type>file<\/type>\n<content>\n([\s\S]*)\n<\/content>$/u.exec(text)?.[1];
			if (body === void 0) return void 0;
			return {
				card: "read",
				path: meta.path,
				offset: meta.offset,
				lines: meta.lines,
				totalLines: meta.totalLines,
				...meta.lang === void 0 ? {} : { lang: meta.lang },
				content: [{
					type: "text",
					text: body
				}]
			};
		},
		presentCall(args) {
			const { offset, limit } = args;
			const window = limit !== void 0 && limit > 0 ? ` (${offset ?? 1} - ${(offset ?? 1) + limit - 1})` : offset !== void 0 ? ` (from line ${offset})` : "";
			return {
				card: "generic",
				title: `Read ${args.file_path}${window}`,
				kind: "read",
				locations: [{
					path: args.file_path,
					line: offset ?? 1
				}]
			};
		}
	}));
}
/**
* Compute one {@link FileDiff} per hunk between `before` and `after`, each carrying the
* applied change plus {@link DIFF_CONTEXT} context lines. Pure insertions use `oldText: null`,
* patch-only no-newline markers are omitted, and scattered replacements remain separate hunks.
*
* @param path - the path stamped on every produced diff (the model-facing `file_path`; the
*   bridge relativizes it).
* @param before - the file text before the change (the backend's LF-normalized diff basis).
* @param after - the file text after the change, on the same basis.
* @returns one diff per applied hunk, in file order; empty when the texts are identical.
*/
function computeHunkDiffs(path, before, after) {
	const patch = structuredPatch("", "", before, after, void 0, void 0, { context: 3 });
	const diffs = [];
	for (const hunk of patch.hunks) {
		const oldLines = [];
		const newLines = [];
		for (const line of hunk.lines) {
			if (line.startsWith("\\")) continue;
			const text = line.slice(1);
			if (line.startsWith("-")) oldLines.push(text);
			else if (line.startsWith("+")) newLines.push(text);
			else {
				oldLines.push(text);
				newLines.push(text);
			}
		}
		diffs.push({
			path,
			oldText: oldLines.length > 0 ? oldLines.join("\n") : null,
			newText: newLines.join("\n")
		});
	}
	return diffs;
}
/** Whether `value` is a valid {@link FileDiff} (defensive narrowing from opaque `meta`). */
function isFileDiff(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const { path, oldText, newText } = value;
	return typeof path === "string" && (oldText === null || typeof oldText === "string") && typeof newText === "string";
}
/**
* Narrow opaque live or replayed result metadata to non-empty file diffs. Malformed metadata
* returns `undefined` so presentation can fall back instead of throwing during replay.
* @param meta - result metadata.
* @returns validated hunks, or `undefined` for absent or malformed data.
*/
function diffsFromMeta(meta) {
	if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return void 0;
	const diffs = meta.diffs;
	if (!Array.isArray(diffs) || diffs.length === 0 || !diffs.every(isFileDiff)) return void 0;
	return diffs;
}
/**
* Read the operation's file path even when the applied diff is empty.
* @param meta - opaque persisted result metadata.
* @returns the recorded path, or undefined for old or malformed metadata.
*/
function pathFromMeta(meta) {
	if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return void 0;
	const path = meta.path;
	return typeof path === "string" && path.length > 0 ? path : void 0;
}
/**
* Model-facing diagnostics for guarded-mutation failures. Providers and
* policies retain operation-specific causes, while this package owns the
* stable message shown to the model.
* @module @deepseek-ai/dsh-tool-fs/src/error
*/
/**
* Render the stable model-facing diagnostic for a guarded-mutation failure.
* `FS_STALE_VERSION` keeps the provider's reason and appends its re-read
* remedy. `FS_NOT_OBSERVED` replaces operation-specific policy/provider text
* with one path-aware reason and read remedy. The original error remains the
* cause, and both diagnostics preserve its code for machine routing. Anything
* else passes through untouched.
* @param error - the caught value from a write/edit execution.
* @param displayPath - the resolved target path shown to the model.
* @returns a remediated `FsError` for the two guarded-mutation codes, else the original value.
*/
function remediateFsError(error, displayPath) {
	if (!(error instanceof FsError)) return error;
	if (error.code === "FS_NOT_OBSERVED") return new FsError(`cannot modify "${displayPath}": file has not been read — read the file, then retry`, error.code, { cause: error });
	if (error.code === "FS_STALE_VERSION") return new FsError(`${error.message} — re-read the file, then retry`, error.code, { cause: error });
	return error;
}
/** Shared observation and result fields for successful file mutations. */
/**
* Record the new file version and expose the mutation result with its canonical path.
* @param ctx - filesystem and observation event owner.
* @param target - resolved file that was mutated.
* @param outcome - successful provider result; its version stays in the observation event.
* @param exec - calling tool execution.
* @returns the provider's result fields without the version, plus the canonical absolute path.
*/
function mutationResult(ctx, target, outcome, exec) {
	const { version, ...result } = outcome;
	ctx.emit("fs/observed", target, {
		kind: "present",
		version
	}, exec);
	return {
		path: ctx.fs.processPath(target),
		...result
	};
}
/**
* Model-facing full-file write. It obtains an optional intent from the single policy slot, calls
* `ctx.fs.writeText` without a stat, then records the resulting version; no policy means an
* unconditional atomic create-or-overwrite.
* @module @deepseek-ai/dsh-tool-fs/src/write
*/
/**
* Validate value constraints the schema DSL can't express: only a non-blank
* `file_path` — an empty `content` is legitimate (it writes an empty file).
* @param args - the schema-validated raw tool arguments.
* @returns the camelCased input; `content` passes through untouched.
*/
function parseWriteArgs(args) {
	if (args.file_path.trim().length === 0) throw new Error("file_path must be a non-empty string");
	return {
		filePath: args.file_path,
		content: args.content
	};
}
/**
* Format a write outcome as one model-facing text block body.
* @param displayPath - the backend-resolved path rendered in the envelope's `<path>` element.
* @param outcome - the write outcome; its `operation` selects the Created/Updated wording.
* @returns the model-facing confirmation envelope (no file content is echoed back).
*/
function formatWriteOutput(displayPath, outcome) {
	return `<path>${displayPath}</path>
<type>file</type>
<content>
${outcome.operation === "create" ? "Created" : "Updated"} file
</content>`;
}
/**
* Register the `write` tool and its scope-aware system-prompt guidance.
* @param ctx - the plugin context; registrations are effects scoped to it, and execution uses its `fs` service.
* @param sandbox - the shared sandbox-escalation API (advertisement, mode stamping, denial mapping).
*/
function applyWriteTool(ctx, sandbox) {
	ctx.systemPrompt.section({
		name: "tool:write",
		order: ctx.systemPrompt.getSectionOrder("TOOL_WRITE"),
		text: ({ scope }) => ctx.tools.get("write", scope) === void 0 ? "" : "Read an existing file before overwriting it with write (the default fs-observation-policy requires it)" + (ctx.tools.get("edit", scope) === void 0 ? "" : " and prefer edit for targeted changes") + "."
	});
	ctx.tools.register(defineTool({
		name: "write",
		description: "Create or fully replace a UTF-8 text file.",
		parameters: {
			file_path: {
				type: "string",
				required: true,
				description: "Path to write, resolved by the filesystem backend. Provide `file_path` before `content` in the arguments."
			},
			content: {
				type: "string",
				required: true,
				description: "Full UTF-8 text content to write."
			},
			...sandbox.escalationModes.length > 0 ? sandbox.schemaFields() : {}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					path: {
						type: "string",
						required: true,
						description: "Canonical absolute path in the filesystem execution world."
					},
					operation: {
						type: "string",
						required: true,
						enum: ["create", "update"]
					},
					before: {
						required: true,
						oneOf: [{ type: "string" }, { type: "null" }]
					},
					after: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: formatWriteOutput(value.path, value)
			}],
			presentationMeta: (_args, value) => ({
				operation: value.operation,
				path: value.path,
				diffs: value.before === null ? [] : computeHunkDiffs(value.path, value.before, value.after).map(({ path, oldText, newText }) => ({
					path,
					oldText,
					newText
				}))
			})
		},
		async execute(args, exec) {
			const input = parseWriteArgs(args);
			const sandboxPolicy = await sandbox.resolvePolicy("write", args, exec);
			const target = await ctx.fs.resolve(input.filePath, await sessionResolveOptions(ctx, exec));
			const intent = await ctx.waterfall("fs/write-intent", target, exec, () => void 0);
			let outcome;
			try {
				outcome = await ctx.fs.writeText(target, input.content, intent, exec.signal, sandboxPolicy);
			} catch (error) {
				throw remediateFsError(sandbox.mapError(error, sandboxPolicy), target.displayPath);
			}
			return mutationResult(ctx, target, outcome, exec);
		},
		presentCall(args) {
			return {
				card: "diff",
				title: `Write ${args.file_path}`,
				diffs: [{
					path: args.file_path,
					oldText: null,
					newText: args.content
				}],
				locations: [{ path: args.file_path }]
			};
		},
		presentResult(args, result) {
			if (result.isError) return void 0;
			const diffs = diffsFromMeta(result.meta) ?? [{
				path: pathFromMeta(result.meta) ?? args.file_path,
				oldText: null,
				newText: args.content
			}];
			return {
				card: "diff",
				title: `Write ${args.file_path}`,
				diffs
			};
		}
	}));
}
/**
* Model-facing literal edit, unique-match by default. It obtains an optional guard from the
* single intent slot, calls `ctx.fs.editText` without a separate stat, then records the observed
* version; no policy means an unconditional atomic edit.
* @module @deepseek-ai/dsh-tool-fs/src/edit
*/
/**
* Validate value constraints the schema DSL can't express: a non-blank
* `file_path`, a non-empty `old_string`, and `old_string !== new_string`
* (an equal pair would be a guaranteed no-op edit).
* @param args - the schema-validated raw tool arguments.
* @returns the camelCased input with `replace_all` defaulted to false.
*/
function parseEditArgs(args) {
	if (args.file_path.trim().length === 0) throw new Error("file_path must be a non-empty string");
	if (args.old_string.length === 0) throw new Error("old_string must be a non-empty string");
	if (args.old_string === args.new_string) throw new Error("old_string and new_string must differ");
	return {
		filePath: args.file_path,
		oldString: args.old_string,
		newString: args.new_string,
		replaceAll: args.replace_all ?? false
	};
}
/**
* Format an edit success (single-match or replace-all) as a Claude-style model-facing message.
* @param displayPath - the backend-resolved path shown to the model.
* @param replaceAll - selects the all-occurrences wording over the single-replacement one.
* @returns the confirmation sentence the model sees as the tool result.
*/
function formatEditOutput(displayPath, replaceAll) {
	return replaceAll ? `The file ${displayPath} has been updated. All occurrences were successfully replaced.` : `The file ${displayPath} has been updated successfully.`;
}
/**
* Register the `edit` tool and its scope-aware system-prompt guidance.
* @param ctx - the plugin context; registrations are effects scoped to it, and execution uses its `fs` service.
* @param sandbox - the shared sandbox-escalation API (advertisement, mode stamping, denial mapping).
*/
function applyEditTool(ctx, sandbox) {
	ctx.systemPrompt.section({
		name: "tool:edit",
		order: ctx.systemPrompt.getSectionOrder("TOOL_EDIT"),
		text: ({ scope }) => ctx.tools.get("edit", scope) === void 0 ? "" : "Read a file before editing it (the default fs-observation-policy requires it), unless you just created or edited it in this session."
	});
	ctx.tools.register(defineTool({
		name: "edit",
		description: "Edit an existing UTF-8 text file by replacing literal text.",
		parameters: {
			file_path: {
				type: "string",
				required: true,
				description: "Path to edit, resolved by the filesystem backend. Provide `file_path` before `old_string` and `new_string` in the arguments."
			},
			old_string: {
				type: "string",
				required: true,
				description: "Literal text to replace."
			},
			new_string: {
				type: "string",
				required: true,
				description: "Literal replacement text. Use an empty string to delete the match."
			},
			replace_all: {
				type: "boolean",
				description: "Replace all matches. Defaults to false; when false, old_string must appear exactly once."
			},
			...sandbox.escalationModes.length > 0 ? sandbox.schemaFields() : {}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					path: {
						type: "string",
						required: true,
						description: "Canonical absolute path in the filesystem execution world."
					},
					before: {
						type: "string",
						required: true
					},
					after: {
						type: "string",
						required: true
					}
				}
			},
			render: (args, value) => [{
				type: "text",
				text: formatEditOutput(value.path, args.replace_all ?? false)
			}],
			presentationMeta: (_args, value) => ({
				path: value.path,
				diffs: computeHunkDiffs(value.path, value.before, value.after).map(({ path, oldText, newText }) => ({
					path,
					oldText,
					newText
				}))
			})
		},
		async execute(args, exec) {
			const input = parseEditArgs(args);
			const sandboxPolicy = await sandbox.resolvePolicy("edit", args, exec);
			const target = await ctx.fs.resolve(input.filePath, await sessionResolveOptions(ctx, exec));
			let outcome;
			try {
				const intent = await ctx.waterfall("fs/edit-intent", target, exec, () => void 0);
				outcome = await ctx.fs.editText(target, {
					oldString: input.oldString,
					newString: input.newString,
					replaceAll: input.replaceAll
				}, intent, exec.signal, sandboxPolicy);
			} catch (error) {
				throw remediateFsError(sandbox.mapError(error, sandboxPolicy), target.displayPath);
			}
			return mutationResult(ctx, target, outcome, exec);
		},
		presentCall(args) {
			return {
				card: "diff",
				title: `Edit ${args.file_path}`,
				diffs: [{
					path: args.file_path,
					oldText: args.old_string || null,
					newText: args.new_string
				}],
				locations: [{ path: args.file_path }]
			};
		},
		presentResult(args, result) {
			if (result.isError) return void 0;
			const diffs = diffsFromMeta(result.meta);
			if (diffs === void 0) return void 0;
			return {
				card: "diff",
				title: `Edit ${args.file_path}`,
				diffs
			};
		}
	}));
}
/**
* The model-facing `read_image` tool commits a PNG/JPEG/WebP/GIF file. A path
* without a file extension is identified from its file signature, while the
* attachment service's full decode stays authoritative. The mounted `ctx.fs`
* backend owns path resolution and read access; names only declare media type.
*
* The route gate is deliberately stricter than the host upload preflight. An
* image-reading tool is useful only when the exact calling route can inspect
* its result, so unknown capability refuses instead of relying on an adapter
* failure after filesystem and attachment work.
* @module @deepseek-ai/dsh-tool-fs/src/read-image
*/
/** Extensions `read_image` accepts; magic-byte validation at the attachment service stays authoritative. */
const IMAGE_EXTENSIONS = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif": "image/gif"
};
const PNG_SIGNATURE = [
	137,
	80,
	78,
	71,
	13,
	10,
	26,
	10
];
const JPEG_SIGNATURE = [
	255,
	216,
	255
];
function matchesBytes(data, offset, expected) {
	if (data.byteLength < offset + expected.length) return false;
	return expected.every((byte, index) => data[offset + index] === byte);
}
function matchesAscii(data, offset, value) {
	if (data.byteLength < offset + value.length) return false;
	for (let index = 0; index < value.length; index += 1) if (data[offset + index] !== value.charCodeAt(index)) return false;
	return true;
}
/**
* Identify the media type declared by a supported image file signature.
* @param data - file bytes read through the current filesystem backend.
* @returns the detected supported media type, or undefined for other bytes.
*/
function sniffImageMediaType(data) {
	if (matchesBytes(data, 0, PNG_SIGNATURE)) return "image/png";
	if (matchesBytes(data, 0, JPEG_SIGNATURE)) return "image/jpeg";
	if (matchesAscii(data, 0, "GIF87a") || matchesAscii(data, 0, "GIF89a")) return "image/gif";
	if (matchesAscii(data, 0, "RIFF") && matchesAscii(data, 8, "WEBP")) return "image/webp";
}
const IMAGE_VALUE_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: true,
	properties: {
		attachmentId: {
			type: "string",
			required: true
		},
		mediaType: {
			type: "string",
			enum: [
				"image/png",
				"image/jpeg",
				"image/webp",
				"image/gif"
			],
			required: true
		},
		bytes: {
			type: "integer",
			required: true
		},
		width: {
			type: "integer",
			required: true
		},
		height: {
			type: "integer",
			required: true
		},
		name: { type: "string" },
		originalDimensions: {
			type: "object",
			additionalProperties: false,
			properties: {
				width: {
					type: "integer",
					required: true
				},
				height: {
					type: "integer",
					required: true
				}
			}
		}
	}
};
/**
* Map a model-supplied path to its declared image media type by extension.
* @param filePath - the raw `file_path` argument (not yet resolved).
* @returns the declared media type, or undefined when the path does not claim an image.
*/
function imageMediaTypeForPath(filePath) {
	return IMAGE_EXTENSIONS[extname(filePath).toLowerCase()];
}
/**
* Enforce the strict image-capability gate for the calling route. Resolves the
* session's latest routed provider/model (request header config, then agent
* options) and requires the exact resolved route to declare `image` input explicitly.
* @param ctx - the plugin context used to resolve the optional `llm` service.
* @param exec - the tool-execution context supplying the calling agent.
* @param requestedPath - the raw, not-yet-resolved path rendered in refusal messages.
*/
async function assertImageCapableRoute(ctx, exec, requestedPath) {
	const routed = exec.agent?.session.requestHeader()?.config;
	const provider = routed?.provider ?? exec.agent?.options.provider;
	const model = routed?.model ?? exec.agent?.options.model;
	const llm = ctx.get("llm");
	if (provider === void 0 || model === void 0 || llm === void 0) throw new Error(`cannot read "${requestedPath}" as an image: the current model route could not be resolved`);
	const active = await llm.resolveModelInfo(provider, model, exec.signal);
	if (active.inputModalities === void 0 || !active.inputModalities.includes("image")) throw new Error(`cannot read "${requestedPath}" as an image: model "${model}" does not declare image input; switch to an image-capable model to read images`);
}
/** Refuse a media type outside the deployment's accepted set, naming the offending path. */
function assertDeploymentAccepts(attachments, mediaType, displayPath) {
	if (!attachments.imageLimits.mediaTypes.includes(mediaType)) throw new Error(`cannot read "${displayPath}": ${mediaType} images are not accepted by this deployment`);
}
/**
* Re-brand a structured image outcome into the durable attachment reference an
* `ImageBlock` carries.
* @param image - the image metadata from the output schema.
* @returns the branded attachment reference.
*/
function imageRefFromValue(image) {
	return {
		attachmentId: AttachmentId(image.attachmentId),
		mediaType: image.mediaType,
		bytes: image.bytes,
		width: image.width,
		height: image.height,
		...image.name === void 0 ? {} : { name: image.name },
		...image.originalDimensions === void 0 ? {} : { originalDimensions: { ...image.originalDimensions } }
	};
}
/**
* Format an image read as the model-facing envelope beside its image block.
* A downscaled read names the on-disk dimensions and the multiplier that maps
* coordinates measured on the attached image back onto the original file.
* @param displayPath - the backend-resolved path rendered in the envelope's `<path>` element.
* @param image - the image metadata to summarize.
* @returns the model-facing envelope; the image itself rides the adjacent image block.
*/
function formatImageReadOutput(displayPath, image) {
	let scaled = "";
	if (image.originalDimensions !== void 0) {
		const x = (image.originalDimensions.width / image.width).toFixed(2);
		const y = (image.originalDimensions.height / image.height).toFixed(2);
		const advice = x === y ? `multiply coordinates by ${x}` : `multiply x coordinates by ${x} and y coordinates by ${y}`;
		scaled = ` (downscaled from ${image.originalDimensions.width}x${image.originalDimensions.height} px; ${advice} to locate features in the original file)`;
	}
	return `<path>${displayPath}</path>
<type>image</type>
<content>
${image.mediaType} image, ${image.width}x${image.height} px, ${image.bytes} bytes${scaled}
</content>`;
}
/**
* Project one structured image read into its model-facing envelope and image.
* @param value - the image-read outcome.
* @returns the two content blocks used by native and nested dispatches.
*/
function imageReadContent(value) {
	return [{
		type: "text",
		text: formatImageReadOutput(value.path, value.image)
	}, {
		type: "image",
		attachment: imageRefFromValue(value.image)
	}];
}
/**
* Register the `read_image` tool into the given context. The composing plugin
* owns the attachments gate: `src/index.ts` calls this inside
* `ctx.inject(['attachments'], …)` so the tool exists only while a durable
* store is mounted. Execution still re-checks `ctx.get('attachments')` for
* direct callers and gates on the calling route's declared image input.
* @param ctx - the registration scope; execution uses its `fs` service plus
*   the optional `attachments`/`llm` services.
*/
function applyReadImageTool(ctx) {
	ctx.tools.register(defineTool({
		name: "read_image",
		description: "Read a PNG/JPEG/WebP/GIF file and return the image itself. Large images are downscaled automatically; do not install image libraries or create thumbnails to inspect an image.",
		parameters: { file_path: {
			type: "string",
			required: true,
			description: "Path to the image file, resolved by the filesystem backend."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					path: {
						type: "string",
						required: true,
						description: "Canonical absolute path in the filesystem execution world."
					},
					image: IMAGE_VALUE_SCHEMA
				}
			},
			render: (_args, value) => imageReadContent(value),
			presentationMeta: (_args, value) => ({ path: value.path })
		},
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			if (args.file_path.trim().length === 0) throw new Error("file_path must be a non-empty string");
			const extension = extname(args.file_path).toLowerCase();
			const declared = imageMediaTypeForPath(args.file_path);
			if (declared === void 0 && extension !== "") throw new Error(`cannot read "${args.file_path}": the ${extension} extension does not declare a supported image format; read_image accepts PNG/JPEG/WebP/GIF files, including extension-less files in those formats`);
			const attachments = ctx.get("attachments");
			if (attachments === void 0) throw new Error(`cannot read "${args.file_path}" as an image: no attachment service is mounted`);
			if (declared !== void 0) assertDeploymentAccepts(attachments, declared, args.file_path);
			await assertImageCapableRoute(ctx, exec, args.file_path);
			const { target, info } = await resolveRegularReadTarget(ctx, exec, args.file_path);
			const byteCap = Math.min(attachments.imageLimits.maxImageBytes, attachments.imageLimits.maxMessageImageBytes);
			const data = await ctx.fs.readBytes(target, exec.signal, byteCap);
			const mediaType = declared ?? sniffImageMediaType(data);
			if (mediaType === void 0) throw new Error(`cannot read "${target.displayPath}": the file content is not a supported image format; read_image accepts PNG/JPEG/WebP/GIF`);
			if (declared === void 0) assertDeploymentAccepts(attachments, mediaType, target.displayPath);
			let ref;
			try {
				ref = await attachments.saveImage({
					data,
					mediaType,
					name: basename(target.displayPath)
				});
			} catch (error) {
				if (!(error instanceof AttachmentError)) throw error;
				if (error.code === "IMAGE_DIMENSION_TOO_LARGE") throw new Error(`cannot read "${target.displayPath}": at least one image side exceeds the ${attachments.imageLimits.maxImageDimension}px limit; downscale the image and read the smaller copy`, { cause: error });
				if (error.code === "IMAGE_TOO_MANY_PIXELS") throw new Error(`cannot read "${target.displayPath}": the image exceeds the ${attachments.imageLimits.maxImagePixels}-pixel decoded-size limit; downscale the image and read the smaller copy`, { cause: error });
				if (error.code === "IMAGE_TOO_LARGE") throw new Error(`cannot read "${target.displayPath}": the image cannot be stored within the deployment's byte limits; downscale the image and read the smaller copy`, { cause: error });
				if (error.code === "ATTACHMENT_WRITE_FAILED" && /16-bit PNG/iu.test(error.message)) throw new Error(`cannot read "${target.displayPath}": the 16-bit PNG could not be converted to the normalized 8-bit sRGB form; convert it to an 8-bit PNG/JPEG/WebP and retry`, { cause: error });
				if (error.code === "INVALID_IMAGE" && declared === void 0) throw new Error(`cannot read "${target.displayPath}": the bytes do not decode as a supported PNG/JPEG/WebP/GIF image; the file may be truncated or corrupt`, { cause: error });
				if (error.code !== "IMAGE_TYPE_MISMATCH") throw error;
				if (declared === void 0) throw new Error(`cannot read "${target.displayPath}": the file signature claims ${mediaType}, but the bytes decode as a different image format; the file may be corrupt`, { cause: error });
				throw new Error(`cannot read "${target.displayPath}": the ${extension} extension declares ${mediaType}, but the bytes use a different image format; rename the file to match its actual format if it is PNG/JPEG/WebP/GIF, or convert it to one of those formats`, { cause: error });
			}
			ctx.emit("fs/observed", target, {
				kind: "present",
				version: info.version
			}, exec);
			return {
				path: ctx.fs.processPath(target),
				image: {
					attachmentId: ref.attachmentId,
					mediaType: ref.mediaType,
					bytes: ref.bytes,
					width: ref.width,
					height: ref.height,
					...ref.name === void 0 ? {} : { name: ref.name },
					...ref.originalDimensions === void 0 ? {} : { originalDimensions: { ...ref.originalDimensions } }
				}
			};
		},
		presentCall(args) {
			return {
				card: "generic",
				title: `Read image ${args.file_path}`,
				kind: "read",
				locations: [{ path: args.file_path }]
			};
		}
	}));
}
/**
* The sandbox-escalation API shared by the `write` and `edit` tools: the
* per-call policy resolution, the advertised escalation fields, and the denial-marker
* mapping — all delegating the vocabulary and the fail-closed approval
* sequence to `@deepseek-ai/dsh-sandbox` (the same pieces `@deepseek-ai/dsh-tool-bash`
* uses), so bash and fs escalate identically. Built ONCE per plugin from
* `ctx.fs.sandboxMode` (the capability fact — is a confining backend mounted?)
* and shared by both mutating tools.
*
* @module @deepseek-ai/dsh-tool-fs/sandbox
*/
/**
* The filesystem escalation API: advertisement gating, per-call policy
* resolution, the one-approved wider retry, and denial-marker mapping. A pure
* product of `ctx` at plugin apply time.
*/
var FsSandboxController = class {
	ctx;
	/** The escalation targets this composition advertises (`[]` when no confining backend is mounted). */
	escalationModes;
	/** Shared per-session policy resolver, required by a confining backend. */
	policy;
	constructor(ctx) {
		this.ctx = ctx;
		const defaultMode = ctx.fs.sandboxMode;
		this.escalationModes = defaultMode === void 0 ? [] : ESCALATION_TARGETS;
		this.policy = defaultMode === void 0 ? void 0 : ctx.get("sandboxPolicy");
		if (defaultMode !== void 0 && this.policy === void 0) throw new Error("tool-fs: the mounted filesystem confines but ctx.sandboxPolicy is missing");
	}
	/**
	* The escalation schema fields for a mutating tool's `parameters`. Call it
	* only under a confining backend (guard on {@link escalationModes}); the
	* enum pins the closed target vocabulary, the strict-wider check happens per
	* call at execution.
	* @returns the two escalation parameter specs.
	*/
	schemaFields() {
		return {
			sandbox_permissions: {
				type: "string",
				enum: [...this.escalationModes],
				description: sandboxPermissionsDescription("operation")
			},
			justification: {
				type: "string",
				description: "Required with sandbox_permissions: one sentence for the user explaining why this exact file operation needs the wider access. Use the language of the user’s current request."
			}
		};
	}
	/**
	* The policy to stamp onto this mutation: an approved escalation grant (a
	* strictly wider retry resolved through `ctx.approval` before anything
	* executes), else the Session's standing mode. Repeating the standing mode
	* requires no approval. The workspace root is the original Session
	* directory, or the deployment fallback when absent. Validates the escalation argument
	* pairing first.
	* @param toolName - the mutating tool's name, for the approval audit trail.
	* @param args - the call's escalation arguments.
	* @param exec - the tool-execution context (agent, callId, signal).
	* @returns the policy to pass to the mutation, or undefined for an
	*   unsandboxed backend.
	*/
	async resolvePolicy(toolName, args, exec) {
		validateEscalationArgs(args.sandbox_permissions, args.justification);
		const standingPolicy = this.policy?.resolve({ ...exec.agent ? { session: exec.agent.session } : {} });
		if (args.sandbox_permissions === void 0 || args.justification === void 0) return standingPolicy;
		if (this.escalationModes.length === 0) throw new Error("sandbox_permissions is not available in this composition (no sandboxing filesystem to escalate)");
		const policy = standingPolicy;
		const approvedMode = await approveEscalation({
			requestedMode: args.sandbox_permissions,
			justification: args.justification,
			effectiveMode: policy.mode,
			subject: "operation"
		}, {
			approver: this.ctx.get("approval"),
			agent: exec.agent,
			callId: exec.callId,
			toolName,
			signal: exec.signal
		});
		return {
			...policy,
			mode: approvedMode
		};
	}
	/**
	* Map a thrown provider error for the model: a `FS_SANDBOX_DENIED` becomes a
	* `FsError` whose text is the shared `[sandbox: …]` denial marker plus the
	* same-turn escalation hint, so a policy denial reads identically to bash's
	* WHILE keeping the structured `FS_SANDBOX_DENIED` code — `ToolRuntime`
	* populates `result.error` only for `HarnessError` instances, so a plain
	* `Error` would strip the code retry/observers key off. Any other error
	* passes through unchanged. A `FS_SANDBOX_DENIED` only arises under a
	* confining backend, which always advertises the escalation fields, so the
	* hint always applies here.
	* @param error - the error thrown by the mutation.
	* @param policy - the policy stamped onto the call (names the mode in the marker).
	* @returns the error to throw — the marker `FsError` for a sandbox denial, else the original.
	*/
	mapError(error, policy) {
		if (!(error instanceof FsError) || error.code !== "FS_SANDBOX_DENIED") return error;
		const mode = policy.mode;
		return new FsError(`${sandboxDenialMarker(mode)}\n${escalationHintMarker("operation")}`, "FS_SANDBOX_DENIED", { cause: error });
	}
};
/**
* Model-facing read, read_image, write, and edit tools over `ctx.fs`. This package owns schemas, validation,
* read windows, formatting, and observation events, never a concrete provider. An optional
* event policy supplies mutation guards; without one the tools use unconditional provider calls.
* @module @deepseek-ai/dsh-tool-fs
*/
/** Cordis plugin name used by loader diagnostics. */
const name = "tool-fs";
/** Services required by the filesystem tool suite. */
const inject = [
	"tools",
	"fs",
	"systemPrompt",
	"workingDirectory"
];
const Config = z.object({
	read: z.boolean().default(true),
	readImage: z.boolean().default(true),
	write: z.boolean().default(true),
	edit: z.boolean().default(true),
	readLimit: z.number().default(READ_LIMIT),
	readMaxLineLength: z.number().default(READ_MAX_LINE_LENGTH),
	readMaxBytes: z.number().default(READ_MAX_BYTES),
	readStreamMinSize: z.number().default(STREAM_MIN_SIZE)
});
/** Every read cap counts lines/chars/bytes — a positive integer, or windowing arithmetic misbehaves silently. */
function assertPositiveInteger(name, value) {
	if (!Number.isInteger(value) || value < 1) throw new Error(`tool-fs: ${name} must be a positive integer`);
}
/** Register the selected filesystem tools; `read_image` additionally requires a mounted attachment store. */
function apply(ctx, config) {
	const resolved = config;
	assertPositiveInteger("readLimit", resolved.readLimit);
	assertPositiveInteger("readMaxLineLength", resolved.readMaxLineLength);
	assertPositiveInteger("readMaxBytes", resolved.readMaxBytes);
	assertPositiveInteger("readStreamMinSize", resolved.readStreamMinSize);
	if (resolved.read) applyReadTool(ctx, {
		limit: resolved.readLimit,
		maxLineLength: resolved.readMaxLineLength,
		maxBytes: resolved.readMaxBytes,
		streamMinSize: resolved.readStreamMinSize
	});
	if (resolved.readImage) ctx.inject(["attachments"], (imageCtx) => {
		applyReadImageTool(imageCtx);
	});
	if (resolved.write || resolved.edit) {
		const sandbox = new FsSandboxController(ctx);
		if (resolved.write) applyWriteTool(ctx, sandbox);
		if (resolved.edit) applyEditTool(ctx, sandbox);
	}
}
export { Config, apply, inject, name };
