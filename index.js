(() => {
    const MODULE_NAME = 'my_topbar_test';
    const EXTENSION_NAME = 'my-topbar-test';
    const EXTENSION_PATH = resolveExtensionPath();
    const GLOBAL_FLAG = '__myTopbarTestLoaded__';

    function extractExtensionPathFromScriptSrc(scriptSrc) {
        try {
            const parsed = new URL(String(scriptSrc ?? ''), window.location.href);
            const pathname = String(parsed.pathname ?? '');
            const match = pathname.match(/(\/scripts\/extensions\/third-party\/[^/]+)\/index\.js$/);
            return match?.[1] || '';
        } catch (error) {
            return '';
        }
    }

    function resolveExtensionPath() {
        const fallbackPath = `/scripts/extensions/third-party/${EXTENSION_NAME}`;
        const candidateScriptSrcList = [];

        try {
            const currentScriptSrc = typeof document?.currentScript?.src === 'string'
                ? document.currentScript.src
                : '';
            if (currentScriptSrc) {
                candidateScriptSrcList.push(currentScriptSrc);
            }

            const scriptNodes = typeof document?.querySelectorAll === 'function'
                ? document.querySelectorAll('script[src*="/scripts/extensions/third-party/"]')
                : [];

            for (const node of scriptNodes) {
                const nodeSrc = typeof node?.src === 'string' ? node.src : '';
                if (nodeSrc) {
                    candidateScriptSrcList.push(nodeSrc);
                }
            }
        } catch (error) {
            console.warn(`[${MODULE_NAME}] 解析扩展路径失败，使用默认路径。`, error);
            return fallbackPath;
        }

        for (const src of candidateScriptSrcList) {
            const resolvedPath = extractExtensionPathFromScriptSrc(src);
            if (resolvedPath) {
                return resolvedPath;
            }
        }

        return fallbackPath;
    }

    const DEFAULT_TEXT = '琳喵喵很高兴为您服务';
    const EMPTY_CHAT_TEXT = '当前聊天里还没有可读取的消息。';
    const RANGE_NOT_FOUND_TEXT = '标签内没有找到内容,无法截取';
    const RANGE_INCOMPLETE_TEXT = '请同时填写开始标签和结束标签，或者两个都留空。';
    const DEFAULT_PRESET_NAME = '默认预设';
    const TEMPLATE_EDITOR_MODE_EDIT = 'edit';
    const TEMPLATE_EDITOR_MODE_DELETE = 'delete';
    const DEFAULT_TEMPLATE_BLUEPRINTS = Object.freeze([
        Object.freeze({
            label: '润色',
            content: '请润色下面的内容，保持原意不变：\n\n{{text}}',
        }),
        Object.freeze({
            label: '总结',
            content: '请总结下面的内容，并提取重点：\n\n{{text}}',
        }),
        Object.freeze({
            label: '提取要点',
            content: '请提取下面内容的核心要点，并用分点方式输出：\n\n{{text}}',
        }),
    ]);
    const FLOATING_WINDOW_IMAGE_PATH = encodeURI(`${EXTENSION_PATH}/zhaopan/linmm.webp`);
    const FLOATING_LONG_PRESS_DELAY = 320;
    const FLOATING_DOUBLE_CLICK_DELAY = 260;
    const FLOATING_DRAG_THRESHOLD = 12;
    const FLOATING_ACTION_OPTIONS = Object.freeze([
        Object.freeze({ value: 'open_range', label: '打开设置范围' }),
        Object.freeze({ value: 'open_template', label: '打开模板预设' }),
        Object.freeze({ value: 'open_capture_send', label: '打开截取与发送' }),
        Object.freeze({ value: 'open_api', label: '打开api链接' }),
        Object.freeze({ value: 'open_floating_settings', label: '打开悬浮窗设置' }),
        Object.freeze({ value: 'run_manual_trigger', label: '运行手动触发' }),
        Object.freeze({ value: 'run_manual_send', label: '运行手动发送' }),
        Object.freeze({ value: 'toggle_auto_trigger', label: '开关自动触发' }),
        Object.freeze({ value: 'run_stop_flow', label: '运行停止流程' }),
        Object.freeze({ value: 'open_output', label: '打开截取与输出框' }),
    ]);
    const FLOATING_ACTION_VALUE_SET = new Set(FLOATING_ACTION_OPTIONS.map(item => item.value));

    const DEFAULT_SETTINGS = Object.freeze({
        keepTags: false,
        onlyReplaceInTags: false,
        skipReplyConfirm: false,
        startTag: '',
        endTag: '',
        templatePresets: Object.freeze([]),
        currentTemplatePresetId: '',
        floatingWindow: Object.freeze({
            enabled: false,
            clickAction: '',
            longPressAction: '',
            doubleClickAction: '',
            size: Object.freeze({
                length: null,
                width: null,
            }),
            position: Object.freeze({
                left: null,
                top: null,
            }),
        }),
        apiConfig: Object.freeze({
            temperature: '1',
            topP: '',
            topK: '',
            presencePenalty: '',
            frequencyPenalty: '',
            stream: false,
            modelSource: 'same',
            stopString: '',
            customApiBaseUrl: '',
            customApiKey: '',
            customModelName: '',
        }),
    });

    // 防止脚本被重复执行
    if (globalThis[GLOBAL_FLAG]) {
        console.warn(`[${MODULE_NAME}] 脚本已经加载过，跳过重复加载。`);
        return;
    }
    globalThis[GLOBAL_FLAG] = true;

    const context = SillyTavern.getContext();
    const eventSource = context.eventSource;
    const event_types = context.event_types;
    const extensionSettings = context.extensionSettings || (context.extensionSettings = {});
    const saveSettingsDebounced = typeof context.saveSettingsDebounced === 'function'
        ? context.saveSettingsDebounced.bind(context)
        : () => {};
    const saveMetadataDebounced = typeof context.saveMetadataDebounced === 'function'
        ? context.saveMetadataDebounced.bind(context)
        : (typeof context.saveMetadata === 'function'
            ? () => {
                void context.saveMetadata();
            }
            : () => {});
    const Popup = context.Popup;

    const SELECTORS = Object.freeze({
        topBar: '#top-bar',
        anchor: '#extensionsMenuButton',
        button: '#my-topbar-test-button',
        panel: '#my-topbar-test-panel',
        closeBtn: '#my-topbar-test-close-btn', // 新增关闭按钮

        rangeToggleButton: '#my-topbar-test-range-toggle',
        rangeSettings: '#my-topbar-test-range-settings',
        captureSendToggleButton: '#my-topbar-test-capture-send-toggle',
        captureSendSettings: '#my-topbar-test-capture-send-settings',
        apiToggleButton: '#my-topbar-test-api-toggle',
        apiSettings: '#my-topbar-test-api-settings',
        floatingToggleButton: '#my-topbar-test-floating-toggle',
        floatingSettings: '#my-topbar-test-floating-settings',
        autoTriggerEnabledCheckbox: '#my-topbar-test-auto-trigger-enabled',
        skipReplyConfirmCheckbox: '#my-topbar-test-skip-reply-confirm',
        floatingEnabledCheckbox: '#my-topbar-test-floating-enabled',
        floatingClickActionSelect: '#my-topbar-test-floating-click-action',
        floatingLongPressActionSelect: '#my-topbar-test-floating-long-press-action',
        floatingDoubleClickActionSelect: '#my-topbar-test-floating-double-click-action',
        floatingSizeLengthInput: '#my-topbar-test-floating-size-length',
        floatingSizeWidthInput: '#my-topbar-test-floating-size-width',
        keepTagsCheckbox: '#my-topbar-test-keep-tags',
        onlyReplaceInTagsCheckbox: '#my-topbar-test-only-replace-in-tags',
        startTagInput: '#my-topbar-test-start-tag',
        endTagInput: '#my-topbar-test-end-tag',

        templateToggleButton: '#my-topbar-test-template-toggle',
        templateSettings: '#my-topbar-test-template-settings',
        templateBrowseView: '#my-topbar-test-template-browse-view',
        templateEditorView: '#my-topbar-test-template-editor-view',
        templatePresetCurrentButton: '#my-topbar-test-template-preset-current',
        templatePresetOptions: '#my-topbar-test-template-preset-options',
        templatePresetOptionButton: '.my-topbar-test-template-preset-option',
        templateList: '#my-topbar-test-template-list',
        templateDeletePresetButton: '#my-topbar-test-template-delete-preset',
        templateAddPresetButton: '#my-topbar-test-template-add-preset',
        templateRenamePresetButton: '#my-topbar-test-template-rename-preset',
        templateAddButton: '#my-topbar-test-template-add',
        templateExportButton: '#my-topbar-test-template-export',
        templateImportButton: '#my-topbar-test-template-import',
        templateImportInput: '#my-topbar-test-template-import-input',
        templateEditButton: '.my-topbar-test-template-edit-button',
        templateDeleteButton: '.my-topbar-test-template-delete-button',
        templateEditorTitle: '#my-topbar-test-template-editor-title',
        templateEditorLabelInput: '#my-topbar-test-template-editor-label',
        templateEditorTextarea: '#my-topbar-test-template-editor-text',
        templateEditorDeletePanel: '#my-topbar-test-template-editor-delete-panel',
        templateEditorDeleteSkipCheckbox: '#my-topbar-test-template-editor-delete-skip',
        templateEditorSaveButton: '#my-topbar-test-template-editor-save',
        templateEditorExitButton: '#my-topbar-test-template-editor-exit',

        manualTriggerButton: '#my-topbar-test-manual-trigger',
        manualSendButton: '#my-topbar-test-manual-send',
        stopManualFlowButton: '#my-topbar-test-stop-manual-flow',
        outputTextarea: '#my-topbar-test-output',

        apiTemperatureInput: '#my-topbar-test-api-temperature',
        apiTopPInput: '#my-topbar-test-api-top-p',
        apiTopKInput: '#my-topbar-test-api-top-k',
        apiPresencePenaltyInput: '#my-topbar-test-api-presence-penalty',
        apiFrequencyPenaltyInput: '#my-topbar-test-api-frequency-penalty',
        apiStreamCheckbox: '#my-topbar-test-api-stream',
        apiStopStringInput: '#my-topbar-test-api-stop-string',
        apiModelSourceToggle: '#my-topbar-test-api-source-toggle',
        apiModelSourceBody: '#my-topbar-test-api-source-body',
        apiModelSourceCurrent: '#my-topbar-test-api-source-current',
        apiModelSourceOptions: '#my-topbar-test-api-source-options',
        apiModelSourceOptionButton: '.my-topbar-test-api-source-option',
        apiCustomConfig: '#my-topbar-test-api-custom-config',
        apiCustomBaseUrlInput: '#my-topbar-test-api-custom-base-url',
        apiCustomApiKeyInput: '#my-topbar-test-api-custom-api-key',
        apiCustomModelNameInput: '#my-topbar-test-api-custom-model-name',
        apiCustomFetchModelsButton: '#my-topbar-test-api-custom-fetch-models',
        apiCustomModelSelect: '#my-topbar-test-api-custom-model-select',

        mobileTabs: '#my-topbar-test-mobile-tabs',
        mobileTabMenu: '#my-topbar-test-mobile-tab-menu',
        mobileTabOutput: '#my-topbar-test-mobile-tab-output',
        mobileBackButton: '#my-topbar-test-mobile-back',

        replyModal: '#my-topbar-test-reply-modal',
        replyModalTitle: '#my-topbar-test-reply-modal-title',
        replyModalConfirmView: '#my-topbar-test-reply-modal-confirm-view',
        replyModalFeedbackView: '#my-topbar-test-reply-modal-feedback-view',
        replyModalTextarea: '#my-topbar-test-reply-modal-text',
        replyModalConfirmButton: '#my-topbar-test-reply-modal-confirm',
        replyModalRetryButton: '#my-topbar-test-reply-modal-retry',
        replyModalFeedbackButton: '#my-topbar-test-reply-modal-feedback',
        replyModalCloseButton: '#my-topbar-test-reply-modal-close',
        replyModalFeedbackInput: '#my-topbar-test-reply-modal-feedback-input',
        replyModalFeedbackBackButton: '#my-topbar-test-reply-modal-feedback-back',
        replyModalFeedbackSubmitButton: '#my-topbar-test-reply-modal-feedback-submit',

        floatingWindow: '#my-topbar-test-floating-window',
        floatingWindowImage: '#my-topbar-test-floating-image',

        templateApplyButton: '.my-topbar-test-template-apply',
        menuBtns: '.my-topbar-test-menu-btn' // 新增菜单按钮统称
    });

    let initialized = false;
    let extractedBaseText = DEFAULT_TEXT;
    let templateEditorState = null;
    let customModelState = {
        isLoading: false,
        sourceBaseUrl: '',
        models: [],
    };
    let manualSendState = {
        isBusy: false,
        chatId: '',
        requestId: 0,
    };
    let replyModalState = {
        chatId: '',
        source: '',
        promptText: '',
        mode: 'confirm',
        feedbackText: '',
    };

    let autoTriggerState = {
        enabledChatId: '',
        isBusy: false,
        requestId: 0,
        stopRequested: false,
        stoppedByUser: false,
        pendingTimerId: 0,
    };
    let templateDeleteConfirmState = {
        skipForSession: false,
    };
    let templatePresetDrawerOpen = false;
    let templateSortState = {
        timerId: 0,
        pointerId: null,
        startX: 0,
        startY: 0,
        templateId: '',
        isDragging: false,
        dragOffsetX: 0,
        dragOffsetY: 0,
        suppressClick: false,
        captureElement: null,
    };
    let mobileLongPressState = {
        timerId: 0,
        pointerId: null,
        startX: 0,
        startY: 0,
        shown: false,
        suppressClick: false,
    };
    let floatingWindowState = {
        pressTimerId: 0,
        singleClickTimerId: 0,
        pointerId: null,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startTop: 0,
        isDragging: false,
        longPressReady: false,
        lastTapTime: 0,
        lastTapPointerType: '',
        captureElement: null,
    };

    function log(...args) {
        console.log(`[${MODULE_NAME}]`, ...args);
    }

    function deepClone(value) {
        try {
            if (typeof structuredClone === 'function') {
                return structuredClone(value);
            }
        } catch (error) {
            console.warn(`[${MODULE_NAME}] structuredClone 不可用，改用 JSON 复制。`, error);
        }

        return JSON.parse(JSON.stringify(value));
    }

    function savePluginSettings() {
        try {
            saveSettingsDebounced();
        } catch (error) {
            console.warn(`[${MODULE_NAME}] 保存设置失败`, error);
        }
    }

    function normalizeTagName(value) {
        return String(value ?? '').replace(/[<>\s/]/g, '');
    }

    function createTemplateId(index = 0) {
        return `my_topbar_test_template_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function createPresetId(index = 0) {
        return `my_topbar_test_preset_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function createDefaultTemplateItems() {
        return DEFAULT_TEMPLATE_BLUEPRINTS.map((item, index) => ({
            id: createTemplateId(index),
            label: item.label,
            content: item.content,
        }));
    }

    function createDefaultPreset(name = DEFAULT_PRESET_NAME) {
        return {
            id: createPresetId(),
            name,
            templates: createDefaultTemplateItems(),
            selectedTemplateIds: [],
        };
    }

    function createDefaultSettings() {
        const preset = createDefaultPreset();

        return {
            keepTags: DEFAULT_SETTINGS.keepTags,
            onlyReplaceInTags: DEFAULT_SETTINGS.onlyReplaceInTags,
            skipReplyConfirm: DEFAULT_SETTINGS.skipReplyConfirm,
            startTag: DEFAULT_SETTINGS.startTag,
            endTag: DEFAULT_SETTINGS.endTag,
            templatePresets: [preset],
            currentTemplatePresetId: preset.id,
            floatingWindow: deepClone(DEFAULT_SETTINGS.floatingWindow),
            apiConfig: deepClone(DEFAULT_SETTINGS.apiConfig),
        };
    }

    function normalizeFloatingActionValue(value) {
        const normalized = String(value ?? '').trim();
        if (normalized === 'open_auto_trigger') {
            return 'open_capture_send';
        }
        return FLOATING_ACTION_VALUE_SET.has(normalized) ? normalized : '';
    }

    function normalizeFloatingWindowSizeValue(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return null;
        }

        const rounded = Math.round(parsed);
        return rounded > 0 ? rounded : null;
    }

    function normalizeTemplateItem(item, index = 0) {
        return {
            id: String(item?.id ?? '').trim() || createTemplateId(index),
            label: String(item?.label ?? '').trim() || `模板${index + 1}`,
            content: String(item?.content ?? ''),
        };
    }

    function normalizeTemplateList(rawTemplates, fallbackTemplates = createDefaultTemplateItems()) {
        if (!Array.isArray(rawTemplates)) {
            return deepClone(fallbackTemplates);
        }

        return rawTemplates.map((item, index) => normalizeTemplateItem(item, index));
    }

    function normalizeSelectedTemplateIds(rawSelectedTemplateIds, templates) {
        if (!Array.isArray(rawSelectedTemplateIds) || !Array.isArray(templates)) {
            return [];
        }

        const validTemplateIds = new Set(templates.map(item => item.id));
        const seen = new Set();
        const selectedTemplateIds = [];

        for (const rawId of rawSelectedTemplateIds) {
            const templateId = String(rawId ?? '').trim();

            if (!templateId || !validTemplateIds.has(templateId) || seen.has(templateId)) {
                continue;
            }

            seen.add(templateId);
            selectedTemplateIds.push(templateId);
        }

        return selectedTemplateIds;
    }

    function normalizePresetItem(item, index = 0) {
        const fallbackTemplates = index === 0 ? createDefaultTemplateItems() : [];
        const templates = normalizeTemplateList(item?.templates, fallbackTemplates);

        return {
            id: String(item?.id ?? '').trim() || createPresetId(index),
            name: String(item?.name ?? item?.label ?? '').trim() || (index === 0 ? DEFAULT_PRESET_NAME : `${DEFAULT_PRESET_NAME}(${index})`),
            templates,
            selectedTemplateIds: normalizeSelectedTemplateIds(item?.selectedTemplateIds, templates),
        };
    }

    function normalizePresetList(rawPresets) {
        if (!Array.isArray(rawPresets) || rawPresets.length === 0) {
            return [createDefaultPreset()];
        }

        return rawPresets.map((item, index) => normalizePresetItem(item, index));
    }

    function normalizeFloatingWindowConfig(rawFloatingWindowConfig) {
        const source = rawFloatingWindowConfig && typeof rawFloatingWindowConfig === 'object' && !Array.isArray(rawFloatingWindowConfig)
            ? rawFloatingWindowConfig
            : {};
        const rawSize = source.size && typeof source.size === 'object' && !Array.isArray(source.size)
            ? source.size
            : {};
        const rawPosition = source.position && typeof source.position === 'object' && !Array.isArray(source.position)
            ? source.position
            : {};

        return {
            enabled: Boolean(source.enabled),
            clickAction: normalizeFloatingActionValue(source.clickAction),
            longPressAction: normalizeFloatingActionValue(source.longPressAction),
            doubleClickAction: normalizeFloatingActionValue(source.doubleClickAction),
            size: {
                length: normalizeFloatingWindowSizeValue(rawSize.length),
                width: normalizeFloatingWindowSizeValue(rawSize.width),
            },
            position: {
                left: Number.isFinite(rawPosition.left) ? rawPosition.left : null,
                top: Number.isFinite(rawPosition.top) ? rawPosition.top : null,
            },
        };
    }

    function normalizeApiConfig(rawApiConfig) {
        const source = rawApiConfig && typeof rawApiConfig === 'object' && !Array.isArray(rawApiConfig)
            ? rawApiConfig
            : {};

        const defaultApiConfig = DEFAULT_SETTINGS.apiConfig;

        return {
            temperature: String(source.temperature ?? defaultApiConfig.temperature),
            topP: String(source.topP ?? defaultApiConfig.topP),
            topK: String(source.topK ?? defaultApiConfig.topK),
            presencePenalty: String(source.presencePenalty ?? defaultApiConfig.presencePenalty),
            frequencyPenalty: String(source.frequencyPenalty ?? defaultApiConfig.frequencyPenalty),
            stream: Boolean(source.stream),
            modelSource: source.modelSource === 'custom' ? 'custom' : 'same',
            stopString: String(source.stopString ?? defaultApiConfig.stopString),
            customApiBaseUrl: String(source.customApiBaseUrl ?? defaultApiConfig.customApiBaseUrl),
            customApiKey: String(source.customApiKey ?? defaultApiConfig.customApiKey),
            customModelName: String(source.customModelName ?? defaultApiConfig.customModelName),
        };
    }

    function loadSettings() {
        let settings = extensionSettings[MODULE_NAME];

        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
            extensionSettings[MODULE_NAME] = createDefaultSettings();
            settings = extensionSettings[MODULE_NAME];
            return settings;
        }

        if (typeof settings.keepTags !== 'boolean') {
            settings.keepTags = DEFAULT_SETTINGS.keepTags;
        }

        if (typeof settings.onlyReplaceInTags !== 'boolean') {
            settings.onlyReplaceInTags = DEFAULT_SETTINGS.onlyReplaceInTags;
        }

        if (typeof settings.skipReplyConfirm !== 'boolean') {
            settings.skipReplyConfirm = DEFAULT_SETTINGS.skipReplyConfirm;
        }

        if (typeof settings.startTag !== 'string') {
            settings.startTag = DEFAULT_SETTINGS.startTag;
        }

        if (typeof settings.endTag !== 'string') {
            settings.endTag = DEFAULT_SETTINGS.endTag;
        }

        settings.startTag = normalizeTagName(settings.startTag);
        settings.endTag = normalizeTagName(settings.endTag);

        if (!Array.isArray(settings.templatePresets)) {
            const migratedTemplates = normalizeTemplateList(settings.templates, createDefaultTemplateItems());
            const migratedPreset = {
                id: createPresetId(),
                name: DEFAULT_PRESET_NAME,
                templates: migratedTemplates,
                selectedTemplateIds: normalizeSelectedTemplateIds(settings.selectedTemplateIds, migratedTemplates),
            };

            settings.templatePresets = [migratedPreset];
            settings.currentTemplatePresetId = migratedPreset.id;
        }

        settings.templatePresets = normalizePresetList(settings.templatePresets);
        if (!String(settings.currentTemplatePresetId ?? '').trim()) {
            settings.currentTemplatePresetId = settings.templatePresets[0].id;
        }

        if (!settings.templatePresets.some(item => item.id === settings.currentTemplatePresetId)) {
            settings.currentTemplatePresetId = settings.templatePresets[0].id;
        }

        delete settings.templates;
        delete settings.selectedTemplateIds;
        delete settings.hijackReply;
        settings.floatingWindow = normalizeFloatingWindowConfig(settings.floatingWindow);
        settings.apiConfig = normalizeApiConfig(settings.apiConfig);

        return settings;
    }

    function getTemplatePresets(settings = loadSettings()) {
        return Array.isArray(settings.templatePresets) ? settings.templatePresets : [];
    }

    function findPresetIndexById(presetId, settings = loadSettings()) {
        const normalizedPresetId = String(presetId ?? '').trim();
        return getTemplatePresets(settings).findIndex(item => item.id === normalizedPresetId);
    }

    function getCurrentTemplatePreset(settings = loadSettings()) {
        const presetIndex = findPresetIndexById(settings.currentTemplatePresetId, settings);
        if (presetIndex >= 0) {
            return settings.templatePresets[presetIndex];
        }

        return settings.templatePresets[0] || null;
    }

    function shouldSkipReplyConfirm() {
        return Boolean(loadSettings().skipReplyConfirm);
    }

    function isAutoTriggerEnabledForCurrentChat() {
        const currentChatId = getCurrentChatIdValue();
        return Boolean(currentChatId && autoTriggerState.enabledChatId === currentChatId);
    }

    function saveChatMetadata() {
        try {
            saveMetadataDebounced();
        } catch (error) {
            console.warn(`[${MODULE_NAME}] 保存聊天元数据失败`, error);
        }
    }

    function getCurrentChatMetadataEntry(shouldCreate = false) {
        const latestContext = SillyTavern.getContext();
        const chatMetadata = latestContext?.chatMetadata;

        if (!chatMetadata || typeof chatMetadata !== 'object') {
            return shouldCreate ? {} : null;
        }

        const currentValue = chatMetadata[MODULE_NAME];
        if (!currentValue || typeof currentValue !== 'object' || Array.isArray(currentValue)) {
            if (!shouldCreate) {
                return null;
            }

            chatMetadata[MODULE_NAME] = {};
        }

        return chatMetadata[MODULE_NAME];
    }

    function readAutoTriggerEnabledFromCurrentChat() {
        const currentChatId = getCurrentChatIdValue();
        if (!currentChatId) {
            return false;
        }

        const metadataEntry = getCurrentChatMetadataEntry(false);
        return Boolean(metadataEntry?.autoTriggerEnabled);
    }

    function syncAutoTriggerStateFromCurrentChat() {
        const currentChatId = getCurrentChatIdValue();
        autoTriggerState.enabledChatId = currentChatId && readAutoTriggerEnabledFromCurrentChat()
            ? currentChatId
            : '';
    }

    function setAutoTriggerEnabledForCurrentChat(enabled) {
        const currentChatId = getCurrentChatIdValue();

        if (!currentChatId) {
            autoTriggerState.enabledChatId = '';
            if (enabled) {
                showMessage('warning', '当前没有可用聊天，暂时无法开启自动触发。');
            }
            return;
        }

        const metadataEntry = getCurrentChatMetadataEntry(true);
        metadataEntry.autoTriggerEnabled = Boolean(enabled);
        saveChatMetadata();

        autoTriggerState.enabledChatId = enabled ? currentChatId : '';
        autoTriggerState.requestId += 1;
        autoTriggerState.isBusy = false;
        autoTriggerState.stopRequested = false;
        autoTriggerState.stoppedByUser = false;

        if (autoTriggerState.pendingTimerId) {
            window.clearTimeout(autoTriggerState.pendingTimerId);
            autoTriggerState.pendingTimerId = 0;
        }
    }

    function showMessage(type, message) {
        try {
            if (globalThis.toastr && typeof globalThis.toastr[type] === 'function') {
                globalThis.toastr[type](message);
                return;
            }
        } catch (error) {
            console.warn(`[${MODULE_NAME}] toastr 调用失败`, error);
        }

        if (type === 'error') {
            console.error(`[${MODULE_NAME}] ${message}`);
        } else if (type === 'warning') {
            console.warn(`[${MODULE_NAME}] ${message}`);
        } else {
            console.log(`[${MODULE_NAME}] ${message}`);
        }

        if (type === 'error' || type === 'warning') {
            window.alert(message);
        }
    }

    async function askConfirmDialog(title, message) {
        try {
            if (Popup && Popup.show && typeof Popup.show.confirm === 'function') {
                const result = await Popup.show.confirm(title, message);
                return Boolean(result);
            }
        } catch (error) {
            console.warn(`[${MODULE_NAME}] Popup.confirm 调用失败，改用原生 confirm。`, error);
        }

        return window.confirm(`${title}\n\n${message}`);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getCurrentChatIdValue() {
        const latestContext = SillyTavern.getContext();

        if (latestContext && typeof latestContext.getCurrentChatId === 'function') {
            return String(latestContext.getCurrentChatId() ?? '');
        }

        return String(latestContext?.chatId ?? '');
    }

    function setButtonBusyState(selector, isBusy, busyText = '') {
        const $button = $(selector);
        if (!$button.length) {
            return;
        }

        if ($button.data('originalText') === undefined) {
            $button.data('originalText', $button.text());
        }

        $button.prop('disabled', isBusy);

        if (isBusy && busyText) {
            $button.text(busyText);
            return;
        }

        const originalText = $button.data('originalText');
        if (originalText !== undefined) {
            $button.text(originalText);
        }
    }

    function updateManualSendUiState() {
        setButtonBusyState(SELECTORS.manualSendButton, manualSendState.isBusy, '发送中...');
    }

    function setManualSendBusy(isBusy) {
        manualSendState.isBusy = isBusy;
        updateManualSendUiState();
    }

    function isAutoFlowActive() {
        const isAutoConfirmVisible = $(SELECTORS.replyModal).is(':visible')
            && String(replyModalState.source ?? '') === 'auto';

        return autoTriggerState.isBusy || Boolean(autoTriggerState.pendingTimerId) || isAutoConfirmVisible;
    }

    function getFloatingWindowConfig() {
        return loadSettings().floatingWindow;
    }

    function renderFloatingActionSelectOptions() {
        const optionsHtml = [
            '<option value="">未设置</option>',
            ...FLOATING_ACTION_OPTIONS.map(item => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`),
        ].join('');

        [
            SELECTORS.floatingClickActionSelect,
            SELECTORS.floatingLongPressActionSelect,
            SELECTORS.floatingDoubleClickActionSelect,
        ].forEach(selector => {
            const $select = $(selector);
            if ($select.length && $select.html() !== optionsHtml) {
                $select.html(optionsHtml);
            }
        });
    }

    function getDefaultFloatingWindowSize() {
        const fallback = isMobileLayout() ? 72 : 88;

        return {
            length: fallback,
            width: fallback,
        };
    }

    function getResolvedFloatingWindowSize() {
        const floatingWindowConfig = getFloatingWindowConfig();
        const defaultSize = getDefaultFloatingWindowSize();

        return {
            length: normalizeFloatingWindowSizeValue(floatingWindowConfig.size?.length) ?? defaultSize.length,
            width: normalizeFloatingWindowSizeValue(floatingWindowConfig.size?.width) ?? defaultSize.width,
        };
    }

    function syncFloatingWindowSettingsUi() {
        const floatingWindowConfig = getFloatingWindowConfig();
        const defaultSize = getDefaultFloatingWindowSize();

        renderFloatingActionSelectOptions();
        $(SELECTORS.floatingEnabledCheckbox).prop('checked', floatingWindowConfig.enabled);
        $(SELECTORS.floatingClickActionSelect).val(floatingWindowConfig.clickAction);
        $(SELECTORS.floatingLongPressActionSelect).val(floatingWindowConfig.longPressAction);
        $(SELECTORS.floatingDoubleClickActionSelect).val(floatingWindowConfig.doubleClickAction);

        $(SELECTORS.floatingSizeLengthInput)
            .val(Number.isFinite(floatingWindowConfig.size?.length) ? String(floatingWindowConfig.size.length) : '')
            .attr('placeholder', String(defaultSize.length));

        $(SELECTORS.floatingSizeWidthInput)
            .val(Number.isFinite(floatingWindowConfig.size?.width) ? String(floatingWindowConfig.size.width) : '')
            .attr('placeholder', String(defaultSize.width));
    }

    function updateFloatingWindowConfigField(key, value) {
        const settings = loadSettings();
        settings.floatingWindow[key] = value;
        savePluginSettings();
    }

    function updateFloatingWindowPosition(left, top) {
        const settings = loadSettings();
        settings.floatingWindow.position = {
            left,
            top,
        };
        savePluginSettings();
    }

    function updateFloatingWindowSize(sizeKey, value) {
        const settings = loadSettings();
        settings.floatingWindow.size[sizeKey] = value;
        savePluginSettings();
    }

    function handleFloatingWindowSizeInputChanged(selector, sizeKey) {
        const rawValue = String($(selector).val() ?? '').trim();
        if (rawValue === '') {
            updateFloatingWindowSize(sizeKey, null);
            syncFloatingWindowSettingsUi();
            syncFloatingWindowUi();
            return;
        }

        const normalized = normalizeFloatingWindowSizeValue(rawValue);
        if (normalized === null) {
            showMessage('warning', '悬浮窗尺寸请输入大于 0 的数字，留空则使用默认值。');
            syncFloatingWindowSettingsUi();
            return;
        }

        updateFloatingWindowSize(sizeKey, normalized);
        syncFloatingWindowSettingsUi();
        syncFloatingWindowUi();
    }

    function clearFloatingWindowSingleClickTimer() {
        if (floatingWindowState.singleClickTimerId) {
            window.clearTimeout(floatingWindowState.singleClickTimerId);
            floatingWindowState.singleClickTimerId = 0;
        }
    }

    function clearFloatingWindowPressTimer() {
        if (floatingWindowState.pressTimerId) {
            window.clearTimeout(floatingWindowState.pressTimerId);
            floatingWindowState.pressTimerId = 0;
        }
    }

    function releaseFloatingWindowPointerCapture() {
        if (
            floatingWindowState.captureElement
            && floatingWindowState.pointerId !== null
            && typeof floatingWindowState.captureElement.releasePointerCapture === 'function'
        ) {
            try {
                if (
                    typeof floatingWindowState.captureElement.hasPointerCapture !== 'function'
                    || floatingWindowState.captureElement.hasPointerCapture(floatingWindowState.pointerId)
                ) {
                    floatingWindowState.captureElement.releasePointerCapture(floatingWindowState.pointerId);
                }
            } catch (error) {
                console.warn(`[${MODULE_NAME}] 释放悬浮窗指针捕获失败`, error);
            }
        }
    }

    function resetFloatingWindowInteractionState() {
        clearFloatingWindowPressTimer();
        releaseFloatingWindowPointerCapture();

        floatingWindowState.pointerId = null;
        floatingWindowState.startX = 0;
        floatingWindowState.startY = 0;
        floatingWindowState.startLeft = 0;
        floatingWindowState.startTop = 0;
        floatingWindowState.isDragging = false;
        floatingWindowState.longPressReady = false;
        floatingWindowState.captureElement = null;

        $(SELECTORS.floatingWindow).removeClass('is-dragging');
    }

    function clampNumber(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function getFloatingWindowMargin() {
        return isMobileLayout() ? 12 : 16;
    }

    function getFloatingWindowSize() {
        const resolvedSize = getResolvedFloatingWindowSize();

        return {
            width: resolvedSize.width,
            height: resolvedSize.length,
        };
    }

    function getDefaultFloatingWindowPosition() {
        const { width, height } = getFloatingWindowSize();
        const margin = getFloatingWindowMargin();
        const maxLeft = Math.max(margin, window.innerWidth - width - margin);
        const maxTop = Math.max(margin, window.innerHeight - height - margin);
        const preferredTop = window.innerHeight - height - (isMobileLayout() ? 120 : 24);

        return {
            left: maxLeft,
            top: clampNumber(preferredTop, margin, maxTop),
        };
    }

    function clampFloatingWindowPosition(left, top) {
        const { width, height } = getFloatingWindowSize();
        const margin = getFloatingWindowMargin();
        const maxLeft = Math.max(margin, window.innerWidth - width - margin);
        const maxTop = Math.max(margin, window.innerHeight - height - margin);

        return {
            left: clampNumber(left, margin, maxLeft),
            top: clampNumber(top, margin, maxTop),
        };
    }

    function syncFloatingWindowUi() {
        const floatingWindowConfig = getFloatingWindowConfig();
        const $floatingWindow = $(SELECTORS.floatingWindow);
        if (!$floatingWindow.length) {
            return;
        }

        $(SELECTORS.floatingWindowImage).attr('src', FLOATING_WINDOW_IMAGE_PATH);

        const resolvedSize = getResolvedFloatingWindowSize();
        $floatingWindow.css({
            width: `${resolvedSize.width}px`,
            height: `${resolvedSize.length}px`,
        });

        if (!floatingWindowConfig.enabled) {
            resetFloatingWindowInteractionState();
            clearFloatingWindowSingleClickTimer();
            floatingWindowState.lastTapTime = 0;
            floatingWindowState.lastTapPointerType = '';
            $floatingWindow.hide();
            return;
        }

        $floatingWindow.show();

        const hasSavedPosition = Number.isFinite(floatingWindowConfig.position.left) && Number.isFinite(floatingWindowConfig.position.top);
        const nextPosition = hasSavedPosition
            ? clampFloatingWindowPosition(floatingWindowConfig.position.left, floatingWindowConfig.position.top)
            : getDefaultFloatingWindowPosition();

        $floatingWindow.css({
            left: `${nextPosition.left}px`,
            top: `${nextPosition.top}px`,
        });

        if (
            hasSavedPosition
            && (nextPosition.left !== floatingWindowConfig.position.left || nextPosition.top !== floatingWindowConfig.position.top)
        ) {
            updateFloatingWindowPosition(nextPosition.left, nextPosition.top);
        }
    }

    function mountFloatingWindow() {
        if ($(SELECTORS.floatingWindow).length) {
            return;
        }

        $('body').append(`
            <div id="my-topbar-test-floating-window"
                 class="my-topbar-test-floating-window"
                 style="display: none;"
                 role="button"
                 tabindex="0"
                 aria-label="悬浮窗">
                <img id="my-topbar-test-floating-image"
                     class="my-topbar-test-floating-image"
                     src="${FLOATING_WINDOW_IMAGE_PATH}"
                     alt=""
                     draggable="false">
            </div>
        `);
    }

    function getApiConfig() {
        return loadSettings().apiConfig;
    }

    function resolveApiNumber(value, defaultValue, parser = Number) {
        const normalized = String(value ?? '').trim();
        if (normalized === '') {
            return defaultValue;
        }

        const parsed = parser(normalized);
        return Number.isFinite(parsed) ? parsed : defaultValue;
    }

    function getResolvedApiConfig() {
        const apiConfig = getApiConfig();

        return {
            temperature: resolveApiNumber(apiConfig.temperature, 1),
            topP: resolveApiNumber(apiConfig.topP, 1),
            topK: resolveApiNumber(apiConfig.topK, 0, value => Number.parseInt(value, 10)),
            presencePenalty: resolveApiNumber(apiConfig.presencePenalty, 0),
            frequencyPenalty: resolveApiNumber(apiConfig.frequencyPenalty, 0),
            stream: Boolean(apiConfig.stream),
            modelSource: apiConfig.modelSource === 'custom' ? 'custom' : 'same',
            stopString: String(apiConfig.stopString ?? ''),
            customApiBaseUrl: String(apiConfig.customApiBaseUrl ?? ''),
            customApiKey: String(apiConfig.customApiKey ?? ''),
            customModelName: String(apiConfig.customModelName ?? ''),
        };
    }

    function updateApiConfigField(key, value) {
        const settings = loadSettings();
        settings.apiConfig[key] = value;
        savePluginSettings();
    }

    function updateApiConfigString(selector, key) {
        const value = String($(selector).val() ?? '');
        updateApiConfigField(key, value);
    }

    function updateApiConfigBoolean(selector, key) {
        const checked = $(selector).is(':checked');
        updateApiConfigField(key, checked);
    }

    function toggleApiSourceDrawer() {
        $(SELECTORS.apiModelSourceBody).stop(true, true).slideToggle(160);
    }

    function toggleApiSourceOptions() {
        $(SELECTORS.apiModelSourceOptions).stop(true, true).slideToggle(160);
    }

    function setApiModelSource(value) {
        const normalized = value === 'custom' ? 'custom' : 'same';
        updateApiConfigField('modelSource', normalized);
        syncApiConfigUi();
        $(SELECTORS.apiModelSourceOptions).stop(true, true).slideUp(160);
    }

    function withTemporarySettingOverride(target, key, value, restorers) {
        if (!target || typeof target !== 'object') {
            return;
        }

        const hadOwn = Object.prototype.hasOwnProperty.call(target, key);
        const previousValue = target[key];

        target[key] = value;
        restorers.push(() => {
            if (hadOwn) {
                target[key] = previousValue;
            } else {
                delete target[key];
            }
        });
    }

    function applyTemporaryGenerationOverrides(contextValue, resolvedApiConfig) {
        const restorers = [];
        const chatCompletionSettings = contextValue?.chatCompletionSettings;
        const textCompletionSettings = contextValue?.textCompletionSettings;

        withTemporarySettingOverride(chatCompletionSettings, 'temp_openai', resolvedApiConfig.temperature, restorers);
        withTemporarySettingOverride(chatCompletionSettings, 'top_p_openai', resolvedApiConfig.topP, restorers);
        withTemporarySettingOverride(chatCompletionSettings, 'top_k_openai', resolvedApiConfig.topK, restorers);
        withTemporarySettingOverride(chatCompletionSettings, 'pres_pen_openai', resolvedApiConfig.presencePenalty, restorers);
        withTemporarySettingOverride(chatCompletionSettings, 'freq_pen_openai', resolvedApiConfig.frequencyPenalty, restorers);
        withTemporarySettingOverride(chatCompletionSettings, 'stream_openai', resolvedApiConfig.stream, restorers);

        withTemporarySettingOverride(textCompletionSettings, 'temp', resolvedApiConfig.temperature, restorers);
        withTemporarySettingOverride(textCompletionSettings, 'top_p', resolvedApiConfig.topP, restorers);
        withTemporarySettingOverride(textCompletionSettings, 'top_k', resolvedApiConfig.topK, restorers);
        withTemporarySettingOverride(textCompletionSettings, 'presence_pen', resolvedApiConfig.presencePenalty, restorers);
        withTemporarySettingOverride(textCompletionSettings, 'freq_pen', resolvedApiConfig.frequencyPenalty, restorers);
        withTemporarySettingOverride(textCompletionSettings, 'streaming', resolvedApiConfig.stream, restorers);

        return () => {
            while (restorers.length > 0) {
                const restore = restorers.pop();
                restore();
            }
        };
    }

    function syncApiConfigUi() {
        syncStopStringWithEndTagIfNeeded();
        const apiConfig = getApiConfig();

        $(SELECTORS.apiTemperatureInput).val(apiConfig.temperature);
        $(SELECTORS.apiTopPInput).val(apiConfig.topP);
        $(SELECTORS.apiTopKInput).val(apiConfig.topK);
        $(SELECTORS.apiPresencePenaltyInput).val(apiConfig.presencePenalty);
        $(SELECTORS.apiFrequencyPenaltyInput).val(apiConfig.frequencyPenalty);
        $(SELECTORS.apiStreamCheckbox).prop('checked', apiConfig.stream);
        $(SELECTORS.apiStopStringInput).val(apiConfig.stopString);
        $(SELECTORS.apiModelSourceCurrent).text(apiConfig.modelSource === 'custom' ? '自定义' : '与酒馆相同');
        const nextValue = apiConfig.modelSource === 'custom' ? 'same' : 'custom';
        const nextLabel = nextValue === 'custom' ? '自定义' : '与酒馆相同';
        $(SELECTORS.apiModelSourceOptions).html(`
            <button type="button"
                    class="menu_button my-topbar-test-api-source-option"
                    data-source-value="${nextValue}">
                ${nextLabel}
            </button>
        `);

        $(SELECTORS.apiCustomBaseUrlInput).val(apiConfig.customApiBaseUrl);
        $(SELECTORS.apiCustomApiKeyInput).val(apiConfig.customApiKey);
        $(SELECTORS.apiCustomModelNameInput).val(apiConfig.customModelName);
        const isCustomSource = apiConfig.modelSource === 'custom';
        $(SELECTORS.apiCustomConfig).toggle(isCustomSource);
        syncCustomModelSelectUi();
    }

    function isMobileLayout() {
        try {
            return Boolean(window.matchMedia && window.matchMedia('(max-width: 850px)').matches);
        } catch (error) {
            return false;
        }
    }

    function setMobilePanelView(view) {
        const normalized = view === 'output' ? 'output' : (view === 'detail' ? 'detail' : 'menu');
        $(SELECTORS.panel).attr('data-mobile-view', normalized);
        syncMobileTabsUi();
    }

    function syncMobileTabsUi() {
        if (!isMobileLayout()) {
            $(SELECTORS.panel).removeAttr('data-mobile-view');
            return;
        }

        const view = String($(SELECTORS.panel).attr('data-mobile-view') ?? 'menu');
        const isOutput = view === 'output';
        const isDetail = view === 'detail';

        $(SELECTORS.mobileTabMenu)
            .toggleClass('active', !isOutput)
            .attr('aria-pressed', String(!isOutput));
        $(SELECTORS.mobileTabOutput)
            .toggleClass('active', isOutput)
            .attr('aria-pressed', String(isOutput));

        $(SELECTORS.mobileBackButton).css('display', !isOutput && isDetail ? 'inline-flex' : 'none');
    }

    function normalizeCustomApiBaseUrl(value) {
        return String(value ?? '').trim().replace(/\/+$/, '');
    }

    function joinUrl(baseUrl, path) {
        const normalizedBaseUrl = normalizeCustomApiBaseUrl(baseUrl);
        const normalizedPath = String(path ?? '').trim();

        if (!normalizedBaseUrl) {
            return '';
        }

        if (!normalizedPath) {
            return normalizedBaseUrl;
        }

        if (normalizedPath.startsWith('/')) {
            return `${normalizedBaseUrl}${normalizedPath}`;
        }

        return `${normalizedBaseUrl}/${normalizedPath}`;
    }

    function renderCustomModelSelect(modelIds, selectedValue = '') {
        const $select = $(SELECTORS.apiCustomModelSelect);
        if (!$select.length) {
            return;
        }

        if (!Array.isArray(modelIds) || modelIds.length === 0) {
            $select.prop('disabled', true);
            $select.html('<option value="">获取列表选择</option>');
            $select.val('');
            return;
        }

        const optionsHtml = modelIds
            .map(modelId => {
                const escaped = escapeHtml(modelId);
                return `<option value="${escaped}">${escaped}</option>`;
            })
            .join('');

        $select.prop('disabled', false);
        $select.html(optionsHtml);

        const normalizedSelectedValue = String(selectedValue ?? '').trim();
        if (normalizedSelectedValue && modelIds.includes(normalizedSelectedValue)) {
            $select.val(normalizedSelectedValue);
        } else {
            $select.prop('selectedIndex', 0);
        }
    }

    function syncCustomModelSelectUi() {
        const apiConfig = getApiConfig();
        const baseUrl = normalizeCustomApiBaseUrl(apiConfig.customApiBaseUrl);

        if (!baseUrl || baseUrl !== customModelState.sourceBaseUrl) {
            renderCustomModelSelect([]);
            return;
        }

        renderCustomModelSelect(customModelState.models, apiConfig.customModelName);
    }

    function extractModelIdsFromOpenAiListResponse(data) {
        const items = Array.isArray(data?.data) ? data.data : [];
        const ids = [];
        const seen = new Set();

        for (const item of items) {
            let modelId = '';

            if (typeof item === 'string') {
                modelId = item;
            } else if (item && typeof item === 'object') {
                modelId = String(item.id ?? item.model ?? item.name ?? '');
            }

            modelId = modelId.trim();
            if (!modelId || seen.has(modelId)) {
                continue;
            }

            seen.add(modelId);
            ids.push(modelId);
        }

        return ids;
    }

    async function readResponseJsonSafely(response) {
        try {
            return await response.clone().json();
        } catch (error) {
            return null;
        }
    }

    async function readResponseTextSafely(response) {
        try {
            return await response.clone().text();
        } catch (error) {
            return '';
        }
    }

    async function fetchCustomModelsList() {
        if (customModelState.isLoading) {
            return;
        }

        const apiConfig = getApiConfig();
        const baseUrl = normalizeCustomApiBaseUrl(apiConfig.customApiBaseUrl);
        const apiKey = String(apiConfig.customApiKey ?? '').trim();

        if (!baseUrl) {
            showMessage('warning', '请先填写 API地址。');
            return;
        }

        if (!apiKey) {
            showMessage('warning', '请先填写 API密钥。');
            return;
        }

        const url = joinUrl(baseUrl, 'models');
        if (!url) {
            showMessage('error', 'API地址不合法。');
            return;
        }

        customModelState.isLoading = true;
        setButtonBusyState(SELECTORS.apiCustomFetchModelsButton, true, '获取中...');
        renderCustomModelSelect([]);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
            });

            if (!response.ok) {
                const json = await readResponseJsonSafely(response);
                const text = await readResponseTextSafely(response);
                const message = String(json?.error?.message ?? json?.message ?? '').trim()
                    || (text ? text.slice(0, 300) : '')
                    || `获取模型列表失败（${response.status}）。`;
                throw new Error(message);
            }

            const data = await response.json();
            const modelIds = extractModelIdsFromOpenAiListResponse(data);

            if (modelIds.length === 0) {
                throw new Error('未获取到可用模型列表。');
            }

            customModelState.sourceBaseUrl = baseUrl;
            customModelState.models = modelIds;
            renderCustomModelSelect(modelIds, apiConfig.customModelName);
            showMessage('success', '已获取模型列表。');
        } catch (error) {
            console.error(`[${MODULE_NAME}] 获取模型列表失败`, error);
            customModelState.sourceBaseUrl = '';
            customModelState.models = [];
            renderCustomModelSelect([]);
            showMessage('error', error instanceof Error ? error.message : '获取模型列表失败。');
        } finally {
            customModelState.isLoading = false;
            setButtonBusyState(SELECTORS.apiCustomFetchModelsButton, false);
        }
    }

    function normalizeStopString(value, shouldUseCloseTagFormat, fallbackEndTagName = '') {
        const rawValue = String(value ?? '');
        if (!shouldUseCloseTagFormat) {
            return rawValue;
        }

        const normalizedFallback = normalizeTagName(fallbackEndTagName);
        const extracted = normalizeTagName(rawValue);
        const tagName = extracted || normalizedFallback;

        if (!tagName) {
            return '';
        }

        return `</${tagName}>`;
    }

    function syncStopStringWithEndTagIfNeeded() {
        const settings = loadSettings();
        const apiConfig = settings.apiConfig;
        const stopString = String(apiConfig.stopString ?? '');

        if (stopString.trim()) {
            return;
        }

        const startTagName = String(settings.startTag ?? '').trim();
        const endTagName = String(settings.endTag ?? '').trim();

        if (!startTagName || !endTagName) {
            return;
        }

        const normalized = normalizeStopString('', true, endTagName);
        if (!normalized) {
            return;
        }

        apiConfig.stopString = normalized;
        savePluginSettings();
        $(SELECTORS.apiStopStringInput).val(normalized);
    }

    function getEffectiveStopString() {
        const settings = loadSettings();
        const stopString = String(settings.apiConfig.stopString ?? '');
        if (stopString.trim()) {
            return stopString;
        }

        const startTagName = String(settings.startTag ?? '').trim();
        const endTagName = String(settings.endTag ?? '').trim();
        if (!startTagName || !endTagName) {
            return '';
        }

        return normalizeStopString('', true, endTagName);
    }

    function applyStopStringToReplyText(replyText, stopString) {
        const normalizedReplyText = String(replyText ?? '');
        const normalizedStopString = String(stopString ?? '');
        const trimmedStopString = normalizedStopString.trim();

        if (!trimmedStopString) {
            return normalizedReplyText;
        }

        const index = normalizedReplyText.indexOf(trimmedStopString);
        if (index === -1) {
            return normalizedReplyText;
        }

        return normalizedReplyText.slice(0, index + trimmedStopString.length);
    }

    function extractChatCompletionContent(data) {
        const choices = Array.isArray(data?.choices) ? data.choices : [];
        const firstChoice = choices.length > 0 ? choices[0] : null;

        if (firstChoice && typeof firstChoice === 'object') {
            const message = firstChoice.message;
            if (message && typeof message === 'object' && typeof message.content === 'string') {
                return message.content;
            }

            if (typeof firstChoice.text === 'string') {
                return firstChoice.text;
            }
        }

        return '';
    }

    async function generateWithCustomApi(promptText, resolvedApiConfig) {
        const baseUrl = normalizeCustomApiBaseUrl(resolvedApiConfig.customApiBaseUrl);
        const apiKey = String(resolvedApiConfig.customApiKey ?? '').trim();
        const modelName = String(resolvedApiConfig.customModelName ?? '').trim();

        if (!baseUrl) {
            throw new Error('请先填写 API地址。');
        }

        if (!apiKey) {
            throw new Error('请先填写 API密钥。');
        }

        if (!modelName) {
            throw new Error('请先填写 模型名称。');
        }

        const url = joinUrl(baseUrl, 'chat/completions');
        if (!url) {
            throw new Error('API地址不合法。');
        }

        const body = {
            model: modelName,
            messages: [
                {
                    role: 'user',
                    content: String(promptText ?? ''),
                },
            ],
            temperature: resolvedApiConfig.temperature,
            top_p: resolvedApiConfig.topP,
            presence_penalty: resolvedApiConfig.presencePenalty,
            frequency_penalty: resolvedApiConfig.frequencyPenalty,
            stream: false,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const json = await readResponseJsonSafely(response);
            const text = await readResponseTextSafely(response);
            const message = String(json?.error?.message ?? json?.message ?? '').trim()
                || (text ? text.slice(0, 300) : '')
                || `请求失败（${response.status}）。`;
            throw new Error(message);
        }

        const data = await response.json();
        const content = extractChatCompletionContent(data);
        if (!String(content ?? '').trim()) {
            throw new Error('AI 没有返回可用内容。');
        }

        return String(content);
    }

    function resolveReplyRequestEnvironment() {
        const resolvedApiConfig = getResolvedApiConfig();
        const latestContext = SillyTavern.getContext();
        const isCustomSource = resolvedApiConfig.modelSource === 'custom';

        if (!isCustomSource) {
            if (!latestContext || (typeof latestContext.generateRaw !== 'function' && typeof latestContext.generateQuietPrompt !== 'function')) {
                throw new Error('当前宿主环境不支持手动发送。');
            }
        } else if (typeof fetch !== 'function') {
            throw new Error('当前宿主环境不支持自定义 API 请求。');
        }

        return {
            resolvedApiConfig,
            latestContext,
            isCustomSource,
        };
    }

    async function requestReplyText(promptText, requestEnvironment = resolveReplyRequestEnvironment()) {
        const { resolvedApiConfig, latestContext, isCustomSource } = requestEnvironment;
        let restoreOverrides = () => {};

        try {
            let replyText = '';
            if (isCustomSource) {
                replyText = await generateWithCustomApi(promptText, resolvedApiConfig);
            } else {
                restoreOverrides = applyTemporaryGenerationOverrides(latestContext, resolvedApiConfig);
                if (typeof latestContext.generateRaw === 'function') {
                    replyText = await latestContext.generateRaw({ prompt: promptText });
                } else {
                    replyText = await latestContext.generateQuietPrompt({ quietPrompt: promptText });
                }
            }

            return applyStopStringToReplyText(replyText, getEffectiveStopString());
        } finally {
            restoreOverrides();
        }
    }

    function syncReplyModalView() {
        const isFeedbackMode = replyModalState.mode === 'feedback';
        $(SELECTORS.replyModalTitle).text(isFeedbackMode ? '反馈重来' : 'AI 回复确认');
        $(SELECTORS.replyModalConfirmView).toggle(!isFeedbackMode);
        $(SELECTORS.replyModalFeedbackView).toggle(isFeedbackMode);
    }

    function focusReplyModalTextarea() {
        if (isMobileLayout()) {
            return;
        }

        const $textarea = $(SELECTORS.replyModalTextarea);
        if ($textarea.length) {
            $textarea.trigger('focus');
        }
    }

    function focusReplyModalFeedbackInput() {
        if (isMobileLayout()) {
            return;
        }

        const $textarea = $(SELECTORS.replyModalFeedbackInput);
        if ($textarea.length) {
            $textarea.trigger('focus');
        }
    }

    function blurActiveElement() {
        const activeElement = document.activeElement;
        if (!activeElement || activeElement === document.body || activeElement === document.documentElement) {
            return;
        }

        if (typeof activeElement.blur === 'function') {
            activeElement.blur();
        }
    }

    function blurReplyModalActiveElement() {
        const activeElement = document.activeElement;
        if (!activeElement || activeElement === document.body || activeElement === document.documentElement) {
            return;
        }

        if (!$(activeElement).closest(SELECTORS.replyModal).length) {
            return;
        }

        if (typeof activeElement.blur === 'function') {
            activeElement.blur();
        }
    }

    function syncReplyModalViewportMetrics() {
        const $modal = $(SELECTORS.replyModal);
        if (!$modal.length) {
            return;
        }

        const visualViewport = window.visualViewport;
        const fallbackWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        const fallbackHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const width = Math.max(0, Math.round(visualViewport?.width || fallbackWidth));
        const height = Math.max(0, Math.round(visualViewport?.height || fallbackHeight));
        const offsetTop = Math.max(0, Math.round(visualViewport?.offsetTop || 0));
        const offsetLeft = Math.max(0, Math.round(visualViewport?.offsetLeft || 0));

        $modal.css({
            '--my-topbar-test-reply-modal-width': width ? `${width}px` : '100vw',
            '--my-topbar-test-reply-modal-height': height ? `${height}px` : '100dvh',
            '--my-topbar-test-reply-modal-offset-top': `${offsetTop}px`,
            '--my-topbar-test-reply-modal-offset-left': `${offsetLeft}px`,
        });
    }

    function scheduleReplyModalViewportSync() {
        syncReplyModalViewportMetrics();

        if (!isMobileLayout()) {
            return;
        }

        window.requestAnimationFrame(() => {
            syncReplyModalViewportMetrics();
            window.setTimeout(syncReplyModalViewportMetrics, 80);
            window.setTimeout(syncReplyModalViewportMetrics, 220);
        });
    }

    function setReplyModalMode(mode) {
        replyModalState.mode = mode === 'feedback' ? 'feedback' : 'confirm';
        syncReplyModalView();
    }

    function fadeInReplyModal() {
        const $modal = $(SELECTORS.replyModal);
        if (!$modal.length) {
            return;
        }

        $modal.stop(true, true);
        $modal.css({
            display: 'flex',
            opacity: 0,
        });
        $modal.animate({ opacity: 1 }, 200);
    }

    function fadeOutReplyModal() {
        const $modal = $(SELECTORS.replyModal);
        if (!$modal.length) {
            return;
        }

        $modal.stop(true, true).animate({ opacity: 0 }, 200, function () {
            $(this).css({
                display: 'none',
                opacity: '',
            });
        });
    }

    function showReplyModal(text, chatId = '', source = '', promptText = '') {
        replyModalState.chatId = String(chatId ?? '');
        replyModalState.source = String(source ?? '');
        replyModalState.promptText = String(promptText ?? '');
        replyModalState.mode = 'confirm';
        replyModalState.feedbackText = '';
        $(SELECTORS.replyModalTextarea).val(String(text ?? ''));
        $(SELECTORS.replyModalFeedbackInput).val('');
        ensureReplyModalMounted();
        scheduleReplyModalViewportSync();
        syncReplyModalView();
        blurActiveElement();
        fadeInReplyModal();
        scheduleReplyModalViewportSync();
        focusReplyModalTextarea();
    }

    function hideReplyModal(options = {}) {
        const shouldKeepAutoBusy = Boolean(options.keepAutoBusy);
        const source = String(replyModalState.source ?? '');
        replyModalState.chatId = '';
        replyModalState.source = '';
        replyModalState.promptText = '';
        replyModalState.mode = 'confirm';
        replyModalState.feedbackText = '';
        syncReplyModalView();
        $(SELECTORS.replyModalFeedbackInput).val('');
        blurReplyModalActiveElement();
        fadeOutReplyModal();

        if (source === 'auto' && !shouldKeepAutoBusy) {
            autoTriggerState.isBusy = false;
        }
    }

    function ensureReplyModalMounted() {
        const $modal = $(SELECTORS.replyModal);
        if (!$modal.length) {
            return;
        }

        const $body = $('body');
        if (!$body.length) {
            return;
        }

        if (!$modal.parent().is('body')) {
            $modal.detach();
            $body.append($modal);
        }
    }

    function ensureReplyModalMountedAtInit() {
        // Ensure modal is globally visible even when panel is hidden.
        ensureReplyModalMounted();
        syncReplyModalViewportMetrics();
        syncReplyModalView();
    }

    function openReplyModalFeedbackView() {
        replyModalState.feedbackText = String($(SELECTORS.replyModalFeedbackInput).val() ?? replyModalState.feedbackText ?? '');
        blurReplyModalActiveElement();
        setReplyModalMode('feedback');
        $(SELECTORS.replyModalFeedbackInput).val(replyModalState.feedbackText);
        focusReplyModalFeedbackInput();
    }

    function openReplyModalConfirmView() {
        replyModalState.feedbackText = String($(SELECTORS.replyModalFeedbackInput).val() ?? '');
        blurReplyModalActiveElement();
        setReplyModalMode('confirm');
        focusReplyModalTextarea();
    }

    function buildFeedbackRetryPrompt(feedbackText, promptText) {
        const normalizedFeedbackText = String(feedbackText ?? '').trim();
        const normalizedPromptText = String(promptText ?? '').trim();

        if (!normalizedFeedbackText) {
            return normalizedPromptText;
        }

        if (!normalizedPromptText) {
            return normalizedFeedbackText;
        }

        return `${normalizedFeedbackText}，${normalizedPromptText}`;
    }

    function escapeRegExp(value) {
        return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function extractAllTagInnerTexts(text, startTag, endTag) {
        const sourceText = String(text ?? '');
        const normalizedStartTag = String(startTag ?? '');
        const normalizedEndTag = String(endTag ?? '');

        if (!normalizedStartTag || !normalizedEndTag) {
            return [];
        }

        const regex = new RegExp(`${escapeRegExp(normalizedStartTag)}([\\s\\S]*?)${escapeRegExp(normalizedEndTag)}`, 'g');
        const values = [];
        let match;

        while ((match = regex.exec(sourceText)) !== null) {
            values.push(match[1] ?? '');
            if (match.index === regex.lastIndex) {
                regex.lastIndex += 1;
            }
        }

        return values;
    }

    function replaceAllTagInnerTexts(sourceText, startTag, endTag, replacements) {
        const normalizedSourceText = String(sourceText ?? '');
        const normalizedStartTag = String(startTag ?? '');
        const normalizedEndTag = String(endTag ?? '');

        if (!normalizedStartTag || !normalizedEndTag) {
            return normalizedSourceText;
        }

        const regex = new RegExp(`${escapeRegExp(normalizedStartTag)}([\\s\\S]*?)${escapeRegExp(normalizedEndTag)}`, 'g');
        let index = 0;

        return normalizedSourceText.replace(regex, () => {
            const replacement = index < replacements.length ? replacements[index] : '';
            index += 1;
            return `${normalizedStartTag}${replacement}${normalizedEndTag}`;
        });
    }

    function appendUnreplaceableContentToOutput(unreplaceableText) {
        const normalized = String(unreplaceableText ?? '').trim();
        if (!normalized) {
            return;
        }

        const current = getOutputText();
        const separator = current && current.trim() ? '\n\n' : '';
        setOutputText(`${current}${separator}${normalized}`);
        focusOutputTextarea();
    }

    async function triggerTavernHelperRenderRefresh(messageId) {
        const resolvedMessageId = Number(messageId);
        if (!Number.isFinite(resolvedMessageId)) {
            return;
        }

        let lastError = null;
        const tavernHelper = globalThis.TavernHelper;

        if (tavernHelper && typeof tavernHelper === 'object') {
            if (typeof tavernHelper.setChatMessages === 'function') {
                try {
                    await tavernHelper.setChatMessages(
                        [{ message_id: resolvedMessageId }],
                        { refresh: 'affected' },
                    );
                    return;
                } catch (error) {
                    lastError = error;
                }
            }

            if (typeof tavernHelper.renderOneMessage === 'function') {
                try {
                    await tavernHelper.renderOneMessage(resolvedMessageId);
                    return;
                } catch (error) {
                    lastError = error;
                }
            }

            if (typeof tavernHelper.refreshOneMessage === 'function') {
                try {
                    await tavernHelper.refreshOneMessage(resolvedMessageId);
                    return;
                } catch (error) {
                    lastError = error;
                }
            }
        }

        const builtin = globalThis.builtin;
        if (builtin && typeof builtin.reloadAndRenderChatWithoutEvents === 'function') {
            try {
                await builtin.reloadAndRenderChatWithoutEvents();
                return;
            } catch (error) {
                lastError = error;
            }
        }

        if (lastError) {
            console.warn(`[${MODULE_NAME}] 触发酒馆助手渲染刷新失败`, lastError);
        }
    }

    async function applyReplyReplacement(options) {
        const latestContext = SillyTavern.getContext();
        const chat = latestContext?.chat;
        const currentChatId = getCurrentChatIdValue();

        const replyText = String(options?.replyText ?? '');
        const replySource = String(options?.source ?? '');
        const replyChatId = String(options?.chatId ?? '');
        const shouldCloseModal = Boolean(options?.closeModal);

        if (!replySource) {
            return false;
        }

        if (replySource !== 'manual' && autoTriggerState.stopRequested) {
            // 自动流程被用户停止：按要求 B，把内容写入截取与输出框，不替换消息。
            if (shouldCloseModal && $(SELECTORS.replyModal).is(':visible')) {
                hideReplyModal();
            } else if (replySource === 'auto') {
                autoTriggerState.isBusy = false;
            }
            showMessage('success', '已停止流程');
            if (replySource === 'auto') {
                appendUnreplaceableContentToOutput(replyText);
            }
            return false;
        }

        if (replyChatId && currentChatId !== replyChatId) {
            if (shouldCloseModal) {
                hideReplyModal();
            } else if (replySource === 'auto') {
                autoTriggerState.isBusy = false;
            }
            showMessage('warning', '聊天窗口已切换，当前回复确认框已失效。');
            return false;
        }

        if (!Array.isArray(chat) || chat.length === 0) {
            showMessage('warning', '当前聊天里没有可替换的消息。');
            if (replySource === 'auto') {
                autoTriggerState.isBusy = false;
            }
            return false;
        }

        const lastIndex = chat.length - 1;
        const message = chat[lastIndex];

        if (!message || typeof message !== 'object') {
            showMessage('error', '无法替换最后一条消息。');
            if (replySource === 'auto') {
                autoTriggerState.isBusy = false;
            }
            return false;
        }

        const settings = loadSettings();
        const shouldOnlyReplaceInTags = settings.keepTags && settings.onlyReplaceInTags;

        if (shouldOnlyReplaceInTags) {
            const rangeConfig = getRangeConfig();

            if (!rangeConfig.enabled || rangeConfig.invalid) {
                if (shouldCloseModal) {
                    hideReplyModal();
                } else if (replySource === 'auto') {
                    autoTriggerState.isBusy = false;
                }
                showMessage('warning', '找不到标签,无法替换的内容会输出到截取框末尾.');
                appendUnreplaceableContentToOutput(replyText);
                return false;
            }

            const originalMes = String(message.mes ?? '');
            const oldInnerTexts = extractAllTagInnerTexts(originalMes, rangeConfig.startTag, rangeConfig.endTag);
            const newInnerTexts = extractAllTagInnerTexts(replyText, rangeConfig.startTag, rangeConfig.endTag);

            if (oldInnerTexts.length === 0 || newInnerTexts.length === 0 || oldInnerTexts.length !== newInnerTexts.length) {
                if (shouldCloseModal) {
                    hideReplyModal();
                } else if (replySource === 'auto') {
                    autoTriggerState.isBusy = false;
                }
                showMessage('warning', '找不到标签,无法替换的内容会输出到截取框末尾.');
                appendUnreplaceableContentToOutput(replyText);
                return false;
            }

            message.mes = replaceAllTagInnerTexts(originalMes, rangeConfig.startTag, rangeConfig.endTag, newInnerTexts);
        } else {
            message.mes = replyText;
        }
        if (message.extra && typeof message.extra === 'object' && Object.prototype.hasOwnProperty.call(message.extra, 'display_text')) {
            delete message.extra.display_text;
        }

        if (typeof latestContext.updateMessageBlock === 'function') {
            latestContext.updateMessageBlock(lastIndex, message, { rerenderMessage: true });
        }

        if (typeof latestContext.saveChat === 'function') {
            await latestContext.saveChat();
        }

        if (shouldCloseModal) {
            hideReplyModal();
        } else if (replySource === 'auto') {
            autoTriggerState.isBusy = false;
        }
        showMessage('success', '已替换当前聊天的最后一条消息。');
        void triggerTavernHelperRenderRefresh(lastIndex);
        return true;
    }

    async function handleReplyResult(options) {
        const replyText = String(options?.replyText ?? '');
        const promptText = String(options?.promptText ?? '');
        const chatId = String(options?.chatId ?? '');
        const source = String(options?.source ?? 'manual');

        if (!replyText.trim()) {
            showMessage('warning', 'AI 没有返回可用内容。');
            if (source === 'auto') {
                autoTriggerState.isBusy = false;
            }
            return false;
        }

        if (shouldSkipReplyConfirm()) {
            return await applyReplyReplacement({
                replyText,
                chatId,
                source,
                closeModal: false,
            });
        }

        showReplyModal(replyText, chatId, source, promptText);
        return true;
    }

    async function runReplyRequestFlow(promptText, options = {}) {
        const normalizedPromptText = String(promptText ?? '');
        const source = String(options?.source ?? 'manual');
        const chatId = String(options?.chatId ?? getCurrentChatIdValue());
        const autoRequestId = Number(options?.autoRequestId ?? 0);
        const requestId = manualSendState.requestId + 1;
        manualSendState.requestId = requestId;
        manualSendState.chatId = chatId;
        setManualSendBusy(true);

        try {
            const replyText = await requestReplyText(normalizedPromptText);

            if (autoRequestId && (autoRequestId !== autoTriggerState.requestId || autoTriggerState.stopRequested)) {
                return false;
            }

            if (requestId !== manualSendState.requestId) {
                return false;
            }

            if (getCurrentChatIdValue() !== chatId) {
                showMessage('warning', '聊天窗口已切换，本次回复未写入当前界面。');
                if (source === 'auto') {
                    autoTriggerState.isBusy = false;
                }
                return false;
            }

            return await handleReplyResult({
                replyText,
                promptText: normalizedPromptText,
                chatId,
                source,
            });
        } catch (error) {
            console.error(`[${MODULE_NAME}] ${source === 'auto' ? '自动触发发送失败' : '手动发送失败'}`, error);
            showMessage('error', error instanceof Error ? error.message : '手动发送失败。');
            if (source === 'auto') {
                autoTriggerState.isBusy = false;
            }
            return false;
        } finally {
            if (requestId === manualSendState.requestId) {
                setManualSendBusy(false);
            }
        }
    }

    async function confirmReplaceLastMessage() {
        await applyReplyReplacement({
            replyText: String($(SELECTORS.replyModalTextarea).val() ?? ''),
            chatId: replyModalState.chatId,
            source: replyModalState.source,
            closeModal: true,
        });
    }

    async function handleManualSend() {
        if (manualSendState.isBusy) {
            return;
        }

        if (isAutoFlowActive()) {
            showMessage('warning', '当前正在进行自动触发');
            return;
        }

        const outputText = getOutputText().trim();
        if (!outputText) {
            showMessage('warning', '当前截取框里没有可发送的文字。');
            return;
        }

        const chatIdBefore = getCurrentChatIdValue();
        await runReplyRequestFlow(outputText, {
            source: 'manual',
            chatId: chatIdBefore,
        });
    }

    async function resendReplyFromModal(promptText) {
        const normalizedPromptText = String(promptText ?? '').trim();
        if (!normalizedPromptText) {
            showMessage('warning', '没有找到可重新发送的内容。');
            return;
        }

        const source = String(replyModalState.source ?? 'manual');
        const chatId = String(replyModalState.chatId ?? getCurrentChatIdValue());
        const keepAutoBusy = source === 'auto';
        let autoRequestId = 0;

        if (keepAutoBusy) {
            autoTriggerState.requestId += 1;
            autoTriggerState.stopRequested = false;
            autoTriggerState.isBusy = true;
            autoRequestId = autoTriggerState.requestId;
        }

        hideReplyModal({ keepAutoBusy });
        await runReplyRequestFlow(normalizedPromptText, {
            source,
            chatId,
            autoRequestId,
        });
    }

    async function handleReplyModalRetry() {
        await resendReplyFromModal(replyModalState.promptText);
    }

    async function handleReplyModalFeedbackSubmit() {
        const feedbackText = String($(SELECTORS.replyModalFeedbackInput).val() ?? '').trim();
        if (!feedbackText) {
            showMessage('warning', '请先输入反馈内容。');
            return;
        }

        const nextPromptText = buildFeedbackRetryPrompt(feedbackText, replyModalState.promptText);
        await resendReplyFromModal(nextPromptText);
    }

    function handleChatChanged() {
        manualSendState.requestId += 1;
        if (manualSendState.isBusy) {
            setManualSendBusy(false);
        }

        if ($(SELECTORS.replyModal).is(':visible')) {
            const source = String(replyModalState.source ?? '');
            if (source === 'auto') {
                const replyText = String($(SELECTORS.replyModalTextarea).val() ?? '').trim();
                if (replyText) {
                    appendUnreplaceableContentToOutput(replyText);
                }
            }
            hideReplyModal();
        }

        autoTriggerState.requestId += 1;
        autoTriggerState.isBusy = false;
        autoTriggerState.stopRequested = false;
        autoTriggerState.stoppedByUser = false;

        if (autoTriggerState.pendingTimerId) {
            window.clearTimeout(autoTriggerState.pendingTimerId);
            autoTriggerState.pendingTimerId = 0;
        }

        syncAutoTriggerStateFromCurrentChat();
        syncAutoTriggerUiState();
    }

    function stopManualFlow() {
        const isReplyModalVisible = $(SELECTORS.replyModal).is(':visible');
        const replySource = String(replyModalState.source ?? '');
        if (isAutoFlowActive()) {
            showMessage('warning', '当前正在进行自动触发');
            return;
        }

        const isSending = manualSendState.isBusy;
        const isManualConfirmVisible = isReplyModalVisible && replySource === 'manual';

        if (!isSending && !isManualConfirmVisible) {
            showMessage('warning', '当前没有进行流程');
            return;
        }

        if (isSending) {
            manualSendState.requestId += 1;
            setManualSendBusy(false);
            showMessage('success', '已停止流程');
            return;
        }

        if (isManualConfirmVisible) {
            void (async () => {
                const confirmed = await askConfirmDialog('停止流程', '是否关闭回复确认框？');
                if (!confirmed) {
                    return;
                }

                const isStillManualConfirmVisible = $(SELECTORS.replyModal).is(':visible')
                    && String(replyModalState.source ?? '') === 'manual';
                if (!isStillManualConfirmVisible) {
                    return;
                }

                hideReplyModal();
                showMessage('success', '已停止流程');
            })();
        }
    }

    function stopAutoFlow() {
        const isReplyModalVisible = $(SELECTORS.replyModal).is(':visible');
        const isAutoConfirmVisible = isReplyModalVisible && String(replyModalState.source ?? '') === 'auto';
        const hasPending = Boolean(autoTriggerState.pendingTimerId);

        if (!autoTriggerState.isBusy && !hasPending && !isAutoConfirmVisible) {
            showMessage('warning', '当前没有进行流程');
            return;
        }

        autoTriggerState.stopRequested = true;
        autoTriggerState.requestId += 1;
        autoTriggerState.isBusy = false;

        if (autoTriggerState.pendingTimerId) {
            window.clearTimeout(autoTriggerState.pendingTimerId);
            autoTriggerState.pendingTimerId = 0;
        }

        if (isAutoConfirmVisible) {
            const replyText = String($(SELECTORS.replyModalTextarea).val() ?? '').trim();
            if (replyText) {
                appendUnreplaceableContentToOutput(replyText);
            }
            hideReplyModal();
        }

        showMessage('success', '已停止流程');
    }

    function stopFlow() {
        if (isAutoFlowActive()) {
            stopAutoFlow();
            return;
        }

        stopManualFlow();
    }

    function handleFloatingWindowEnabledCheckboxChanged() {
        updateFloatingWindowConfigField('enabled', $(SELECTORS.floatingEnabledCheckbox).is(':checked'));
        syncFloatingWindowUi();
    }

    function handleFloatingWindowActionSelectChanged(selector, key) {
        updateFloatingWindowConfigField(key, normalizeFloatingActionValue($(selector).val()));
        syncFloatingWindowSettingsUi();
    }

    async function executeFloatingWindowAction(actionValue) {
        const normalizedAction = normalizeFloatingActionValue(actionValue);
        if (!normalizedAction) {
            return;
        }

        switch (normalizedAction) {
            case 'open_range':
                openPanelDetail(switchTabToRange);
                return;
            case 'open_template':
                openPanelDetail(switchTabToTemplate);
                return;
            case 'open_capture_send':
                openPanelDetail(switchTabToCaptureSend);
                return;
            case 'open_api':
                openPanelDetail(switchTabToApiSettings);
                return;
            case 'open_floating_settings':
                openPanelDetail(switchTabToFloatingSettings);
                return;
            case 'run_manual_trigger':
                await handleManualTrigger();
                return;
            case 'run_manual_send':
                await handleManualSend();
                return;
            case 'toggle_auto_trigger':
                setAutoTriggerEnabledForCurrentChat(!isAutoTriggerEnabledForCurrentChat());
                syncAutoTriggerUiState();
                return;
            case 'run_stop_flow':
                stopFlow();
                return;
            case 'open_output':
                openPanelOutput();
                return;
            default:
                return;
        }
    }

    async function triggerFloatingWindowAction(actionKey) {
        const floatingWindowConfig = getFloatingWindowConfig();
        await executeFloatingWindowAction(floatingWindowConfig[actionKey]);
    }

    function handleFloatingWindowTap(pointerType = '') {
        const normalizedPointerType = String(pointerType ?? '');
        const now = Date.now();
        const floatingWindowConfig = getFloatingWindowConfig();
        const hasDoubleClickAction = Boolean(floatingWindowConfig.doubleClickAction);
        const isDoubleTap = hasDoubleClickAction
            && Boolean(floatingWindowState.lastTapTime)
            && now - floatingWindowState.lastTapTime <= FLOATING_DOUBLE_CLICK_DELAY
            && floatingWindowState.lastTapPointerType === normalizedPointerType;

        if (isDoubleTap) {
            clearFloatingWindowSingleClickTimer();
            floatingWindowState.lastTapTime = 0;
            floatingWindowState.lastTapPointerType = '';
            void triggerFloatingWindowAction('doubleClickAction');
            return;
        }

        if (floatingWindowState.singleClickTimerId && !hasDoubleClickAction) {
            clearFloatingWindowSingleClickTimer();
            void triggerFloatingWindowAction('clickAction');
        }

        floatingWindowState.lastTapTime = now;
        floatingWindowState.lastTapPointerType = normalizedPointerType;
        floatingWindowState.singleClickTimerId = window.setTimeout(() => {
            floatingWindowState.singleClickTimerId = 0;
            floatingWindowState.lastTapTime = 0;
            floatingWindowState.lastTapPointerType = '';
            void triggerFloatingWindowAction('clickAction');
        }, FLOATING_DOUBLE_CLICK_DELAY);
    }

    function beginFloatingWindowPress(pointerId, clientX, clientY, captureElement = null) {
        const $floatingWindow = $(SELECTORS.floatingWindow);
        if (!$floatingWindow.length) {
            return;
        }

        clearFloatingWindowPressTimer();
        floatingWindowState.pointerId = pointerId;
        floatingWindowState.startX = clientX;
        floatingWindowState.startY = clientY;
        floatingWindowState.startLeft = Number.parseFloat($floatingWindow.css('left')) || 0;
        floatingWindowState.startTop = Number.parseFloat($floatingWindow.css('top')) || 0;
        floatingWindowState.isDragging = false;
        floatingWindowState.longPressReady = false;
        floatingWindowState.captureElement = captureElement;
        floatingWindowState.pressTimerId = window.setTimeout(() => {
            floatingWindowState.pressTimerId = 0;
            floatingWindowState.longPressReady = true;
        }, FLOATING_LONG_PRESS_DELAY);
    }

    function handleFloatingWindowPointerMove(pointerId, clientX, clientY) {
        if (floatingWindowState.pointerId === null || floatingWindowState.pointerId !== pointerId) {
            return;
        }

        const movedX = clientX - floatingWindowState.startX;
        const movedY = clientY - floatingWindowState.startY;
        const exceededThreshold = Math.abs(movedX) > FLOATING_DRAG_THRESHOLD || Math.abs(movedY) > FLOATING_DRAG_THRESHOLD;

        if (!floatingWindowState.longPressReady) {
            if (exceededThreshold) {
                resetFloatingWindowInteractionState();
            }
            return;
        }

        if (!floatingWindowState.isDragging && exceededThreshold) {
            floatingWindowState.isDragging = true;
            clearFloatingWindowSingleClickTimer();
            $(SELECTORS.floatingWindow).addClass('is-dragging');

            if (
                floatingWindowState.captureElement
                && floatingWindowState.pointerId !== null
                && typeof floatingWindowState.captureElement.setPointerCapture === 'function'
            ) {
                try {
                    floatingWindowState.captureElement.setPointerCapture(floatingWindowState.pointerId);
                } catch (error) {
                    console.warn(`[${MODULE_NAME}] 设置悬浮窗指针捕获失败`, error);
                }
            }
        }

        if (!floatingWindowState.isDragging) {
            return;
        }

        const nextPosition = clampFloatingWindowPosition(
            floatingWindowState.startLeft + movedX,
            floatingWindowState.startTop + movedY,
        );

        $(SELECTORS.floatingWindow).css({
            left: `${nextPosition.left}px`,
            top: `${nextPosition.top}px`,
        });
    }

    function finalizeFloatingWindowPress(pointerId, pointerType = '') {
        if (floatingWindowState.pointerId === null || floatingWindowState.pointerId !== pointerId) {
            return;
        }

        clearFloatingWindowPressTimer();
        const wasDragging = floatingWindowState.isDragging;
        const shouldRunLongPressAction = floatingWindowState.longPressReady && !floatingWindowState.isDragging;
        const currentLeft = Number.parseFloat($(SELECTORS.floatingWindow).css('left')) || 0;
        const currentTop = Number.parseFloat($(SELECTORS.floatingWindow).css('top')) || 0;

        resetFloatingWindowInteractionState();

        if (wasDragging) {
            floatingWindowState.lastTapTime = 0;
            floatingWindowState.lastTapPointerType = '';
            updateFloatingWindowPosition(currentLeft, currentTop);
            return;
        }

        if (shouldRunLongPressAction) {
            clearFloatingWindowSingleClickTimer();
            floatingWindowState.lastTapTime = 0;
            floatingWindowState.lastTapPointerType = '';
            void triggerFloatingWindowAction('longPressAction');
            return;
        }

        handleFloatingWindowTap(pointerType);
    }

    function handleAutoTriggerEnabledCheckboxChanged() {
        const checked = $(SELECTORS.autoTriggerEnabledCheckbox).is(':checked');
        setAutoTriggerEnabledForCurrentChat(checked);
        syncAutoTriggerUiState();
    }

    function handleSkipReplyConfirmCheckboxChanged() {
        const settings = loadSettings();
        settings.skipReplyConfirm = $(SELECTORS.skipReplyConfirmCheckbox).is(':checked');
        savePluginSettings();
    }

    function handleGenerationStopped() {
        autoTriggerState.stoppedByUser = true;
    }

    function queueAutoTriggerFlow() {
        if (!isAutoTriggerEnabledForCurrentChat()) {
            return;
        }

        // ST release 源码：点击停止会先 emit ENDED 再 emit STOPPED，因此必须延迟处理 ENDED。
        const requestId = autoTriggerState.requestId + 1;
        autoTriggerState.requestId = requestId;

        if (autoTriggerState.pendingTimerId) {
            window.clearTimeout(autoTriggerState.pendingTimerId);
        }

        autoTriggerState.pendingTimerId = window.setTimeout(async () => {
            autoTriggerState.pendingTimerId = 0;

            if (requestId !== autoTriggerState.requestId) {
                return;
            }

            if (autoTriggerState.stoppedByUser) {
                autoTriggerState.stoppedByUser = false;
                return;
            }
            autoTriggerState.stoppedByUser = false;

            if (!isAutoTriggerEnabledForCurrentChat()) {
                return;
            }

            if (autoTriggerState.isBusy) {
                return;
            }
            autoTriggerState.isBusy = true;
            autoTriggerState.stopRequested = false;

            try {
                const didExtract = await handleManualTrigger(true);
                if (!didExtract) {
                    return;
                }

                if (requestId !== autoTriggerState.requestId || autoTriggerState.stopRequested) {
                    return;
                }

                // 复用手动发送，但标记为 auto 来源以便停止自动流程时走 B 行为。
                const chatIdBefore = getCurrentChatIdValue();
                const outputText = getOutputText().trim();
                if (!outputText) {
                    return;
                }

                await runReplyRequestFlow(outputText, {
                    source: 'auto',
                    chatId: chatIdBefore,
                    autoRequestId: requestId,
                });
            } catch (error) {
                console.error(`[${MODULE_NAME}] 自动触发流程失败`, error);
                showMessage('error', error instanceof Error ? error.message : '自动触发流程失败。');
            } finally {
                if (requestId === autoTriggerState.requestId) {
                    const isAutoConfirmVisible = $(SELECTORS.replyModal).is(':visible')
                        && String(replyModalState.source ?? '') === 'auto';
                    if (!isAutoConfirmVisible) {
                        autoTriggerState.isBusy = false;
                    }
                }
            }
        }, 0);
    }

    function handleGenerationEnded() {
        queueAutoTriggerFlow();
    }

    // 显示/隐藏全屏面板
    function togglePanel() {
        const $panel = $(SELECTORS.panel);
        const willShow = !$panel.is(':visible');

        if (willShow) {
            if (isMobileLayout()) {
                setMobilePanelView('menu');
            } else {
                syncMobileTabsUi();
            }
        }

        $panel.fadeToggle(200);
    }

    function showPanel() {
        const $panel = $(SELECTORS.panel);
        if (!$panel.length || $panel.is(':visible')) {
            return;
        }

        $panel.stop(true, true).fadeIn(200);
    }

    function hidePanel() {
        $(SELECTORS.panel).fadeOut(200);
    }

    function openPanelDetail(switchTab) {
        showPanel();
        switchTab();

        if (isMobileLayout()) {
            setMobilePanelView('detail');
        } else {
            syncMobileTabsUi();
        }
    }

    function openPanelOutput() {
        showPanel();

        if (isMobileLayout()) {
            setMobilePanelView('output');
        } else {
            syncMobileTabsUi();
        }

        focusOutputTextarea();
    }

    function setOutputText(text) {
        const $textarea = $(SELECTORS.outputTextarea);
        if (!$textarea.length) {
            return;
        }

        $textarea.val(text ?? '');
    }

    function getOutputText() {
        const $textarea = $(SELECTORS.outputTextarea);
        if (!$textarea.length) {
            return '';
        }

        return String($textarea.val() ?? '');
    }

    function focusOutputTextarea() {
        const $textarea = $(SELECTORS.outputTextarea);
        if (!$textarea.length) {
            return;
        }

        $textarea.focus();

        const element = $textarea.get(0);
        if (element && typeof element.setSelectionRange === 'function') {
            const len = element.value.length;
            element.setSelectionRange(len, len);
        }
    }

    function setExtractedBaseText(text) {
        extractedBaseText = String(text ?? '');
    }

    function sanitizeSingleTagInput(selector) {
        const $input = $(selector);
        if (!$input.length) {
            return '';
        }

        const normalized = normalizeTagName($input.val());
        if ($input.val() !== normalized) {
            $input.val(normalized);
        }

        return normalized;
    }

    function updateTagSettingFromInput(selector, settingsKey) {
        const normalized = sanitizeSingleTagInput(selector);
        const settings = loadSettings();

        if (settings[settingsKey] !== normalized) {
            settings[settingsKey] = normalized;
            savePluginSettings();
        }

        return normalized;
    }

    function syncKeepTagsSettingFromCheckbox() {
        const settings = loadSettings();
        const checked = $(SELECTORS.keepTagsCheckbox).is(':checked');

        if (settings.keepTags !== checked) {
            settings.keepTags = checked;
            savePluginSettings();
        }

        syncOnlyReplaceInTagsUi();

        return checked;
    }

    function syncOnlyReplaceInTagsUi() {
        const settings = loadSettings();
        const $checkbox = $(SELECTORS.onlyReplaceInTagsCheckbox);
        if (!$checkbox.length) {
            return;
        }

        const disabled = !settings.keepTags;
        $checkbox.prop('checked', Boolean(settings.onlyReplaceInTags));
        $checkbox.prop('disabled', disabled);
        $checkbox.closest('label').toggleClass('is-disabled', disabled);
    }

    function syncUiFromSettings() {
        const settings = loadSettings();

        $(SELECTORS.keepTagsCheckbox).prop('checked', settings.keepTags);
        syncOnlyReplaceInTagsUi();
        $(SELECTORS.skipReplyConfirmCheckbox).prop('checked', settings.skipReplyConfirm);
        $(SELECTORS.startTagInput).val(settings.startTag);
        $(SELECTORS.endTagInput).val(settings.endTag);

        renderTemplateList();
        syncTemplateEditorState();
        syncApiConfigUi();
        updateManualSendUiState();
        syncAutoTriggerUiState();
        syncFloatingWindowSettingsUi();
        syncFloatingWindowUi();
    }

    function syncAutoTriggerUiState() {
        $(SELECTORS.autoTriggerEnabledCheckbox).prop('checked', isAutoTriggerEnabledForCurrentChat());
    }

    function getRangeConfig() {
        const startName = updateTagSettingFromInput(SELECTORS.startTagInput, 'startTag');
        const endName = updateTagSettingFromInput(SELECTORS.endTagInput, 'endTag');
        const keepTags = syncKeepTagsSettingFromCheckbox();

        if (!startName && !endName) {
            return {
                enabled: false,
                invalid: false,
                keepTags,
                startTag: '',
                endTag: '',
            };
        }

        if (!startName || !endName) {
            return {
                enabled: true,
                invalid: true,
                keepTags,
                startTag: '',
                endTag: '',
                message: RANGE_INCOMPLETE_TEXT,
            };
        }

        return {
            enabled: true,
            invalid: false,
            keepTags,
            startTag: `<${startName}>`,
            endTag: `</${endName}>`,
            startName,
            endName,
        };
    }

    // 切换到 范围设置 标签页
    function switchTabToRange() {
        $(SELECTORS.menuBtns).removeClass('active');
        $(SELECTORS.rangeToggleButton).addClass('active');
        
        $(SELECTORS.captureSendSettings).hide();
        $(SELECTORS.apiSettings).hide();
        $(SELECTORS.templateSettings).hide();
        $(SELECTORS.floatingSettings).hide();
        $(SELECTORS.rangeSettings).fadeIn(200);
        $(SELECTORS.startTagInput).focus();
    }

    // 切换到 模板设置 标签页
    function switchTabToTemplate() {
        $(SELECTORS.menuBtns).removeClass('active');
        $(SELECTORS.templateToggleButton).addClass('active');
        
        $(SELECTORS.rangeSettings).hide();
        $(SELECTORS.captureSendSettings).hide();
        $(SELECTORS.apiSettings).hide();
        $(SELECTORS.floatingSettings).hide();
        $(SELECTORS.templateSettings).fadeIn(200);
        syncTemplateEditorState();
    }

    function switchTabToCaptureSend() {
        $(SELECTORS.menuBtns).removeClass('active');
        $(SELECTORS.captureSendToggleButton).addClass('active');

        $(SELECTORS.rangeSettings).hide();
        $(SELECTORS.templateSettings).hide();
        $(SELECTORS.apiSettings).hide();
        $(SELECTORS.floatingSettings).hide();
        $(SELECTORS.captureSendSettings).fadeIn(200);
    }

    function switchTabToApiSettings() {
        $(SELECTORS.menuBtns).removeClass('active');
        $(SELECTORS.apiToggleButton).addClass('active');

        $(SELECTORS.rangeSettings).hide();
        $(SELECTORS.templateSettings).hide();
        $(SELECTORS.captureSendSettings).hide();
        $(SELECTORS.floatingSettings).hide();
        $(SELECTORS.apiSettings).fadeIn(200);
    }

    function switchTabToFloatingSettings() {
        $(SELECTORS.menuBtns).removeClass('active');
        $(SELECTORS.floatingToggleButton).addClass('active');

        $(SELECTORS.rangeSettings).hide();
        $(SELECTORS.templateSettings).hide();
        $(SELECTORS.captureSendSettings).hide();
        $(SELECTORS.apiSettings).hide();
        $(SELECTORS.floatingSettings).fadeIn(200);
    }

    function getLastMessageText() {
        const latestContext = SillyTavern.getContext();
        const chat = latestContext?.chat;

        if (!Array.isArray(chat) || chat.length === 0) {
            return '';
        }

        const message = chat[chat.length - 1];
        if (!message) {
            return '';
        }

        if (typeof message.mes === 'string') {
            return message.mes;
        }

        if (message.mes !== undefined && message.mes !== null) {
            return String(message.mes);
        }

        return '';
    }

    function extractTextByRange(sourceText) {
        const fullText = typeof sourceText === 'string' ? sourceText : String(sourceText ?? '');
        const rangeConfig = getRangeConfig();

        if (!rangeConfig.enabled) {
            return {
                ok: true,
                text: fullText,
                usedRange: false,
            };
        }

        if (rangeConfig.invalid) {
            return {
                ok: false,
                reason: 'range_incomplete',
                message: rangeConfig.message,
            };
        }

        const startIndex = fullText.indexOf(rangeConfig.startTag);
        if (startIndex === -1) {
            return {
                ok: false,
                reason: 'range_not_found',
                message: RANGE_NOT_FOUND_TEXT,
            };
        }

        const contentStartIndex = startIndex + rangeConfig.startTag.length;
        const endIndex = fullText.indexOf(rangeConfig.endTag, contentStartIndex);

        if (endIndex === -1) {
            return {
                ok: false,
                reason: 'range_not_found',
                message: RANGE_NOT_FOUND_TEXT,
            };
        }

        const text = rangeConfig.keepTags
            ? fullText.slice(startIndex, endIndex + rangeConfig.endTag.length)
            : fullText.slice(contentStartIndex, endIndex);

        return {
            ok: true,
            text,
            usedRange: true,
            keepTags: rangeConfig.keepTags,
            startTag: rangeConfig.startTag,
            endTag: rangeConfig.endTag,
        };
    }

    async function handleManualTrigger(allowWhenAutoBusy = false) {
        if (isAutoFlowActive() && !allowWhenAutoBusy) {
            showMessage('warning', '当前正在进行自动触发');
            return false;
        }

        const lastMessageText = getLastMessageText();

        if (!lastMessageText || !String(lastMessageText).trim()) {
            setExtractedBaseText('');
            setOutputText(EMPTY_CHAT_TEXT);
            focusOutputTextarea();
            return false;
        }

        const result = extractTextByRange(lastMessageText);

        if (!result.ok) {
            if (result.reason === 'range_incomplete') {
                showMessage('warning', RANGE_INCOMPLETE_TEXT);
            } else {
                showMessage('error', RANGE_NOT_FOUND_TEXT);
            }

            setExtractedBaseText('');
            setOutputText(result.message);
            focusOutputTextarea();
            return false;
        }

        setExtractedBaseText(result.text);
        syncOutputFromSelectedTemplates(true);
        return true;
    }

    function findTemplateById(templateId) {
        const currentPreset = getCurrentTemplatePreset();
        if (!currentPreset) {
            return null;
        }

        return currentPreset.templates.find(item => item.id === templateId) || null;
    }

    function getSelectedTemplateList(settings = loadSettings()) {
        const currentPreset = getCurrentTemplatePreset(settings);
        if (!currentPreset) {
            return [];
        }

        const selectedTemplateIdSet = new Set(currentPreset.selectedTemplateIds);
        return currentPreset.templates.filter(item => selectedTemplateIdSet.has(item.id));
    }

    function hasTemplateLabel(label, templates, excludedTemplateId = '') {
        const normalizedLabel = String(label ?? '').trim();
        return templates.some(item => item.id !== excludedTemplateId && String(item.label ?? '').trim() === normalizedLabel);
    }

    function hasPresetName(name, presets, excludedPresetId = '') {
        const normalizedName = String(name ?? '').trim();
        return presets.some(item => item.id !== excludedPresetId && String(item.name ?? '').trim() === normalizedName);
    }

    function getNextDefaultTemplateLabel(templates) {
        if (!hasTemplateLabel('默认模板', templates)) {
            return '默认模板';
        }

        let index = 1;
        while (hasTemplateLabel(`默认模板${index}`, templates)) {
            index += 1;
        }

        return `默认模板${index}`;
    }

    function getUniquePresetName(baseName, presets, excludedPresetId = '') {
        const normalizedBaseName = String(baseName ?? '').trim() || DEFAULT_PRESET_NAME;

        if (!hasPresetName(normalizedBaseName, presets, excludedPresetId)) {
            return normalizedBaseName;
        }

        let index = 1;
        while (hasPresetName(`${normalizedBaseName}(${index})`, presets, excludedPresetId)) {
            index += 1;
        }

        return `${normalizedBaseName}(${index})`;
    }

    function stripFileExtension(fileName) {
        return String(fileName ?? '').replace(/\.[^.]+$/, '').trim();
    }

    function getNextImportedTemplateLabel(baseLabel, templates) {
        const normalizedBaseLabel = String(baseLabel ?? '').trim() || '模板';

        if (!hasTemplateLabel(normalizedBaseLabel, templates)) {
            return normalizedBaseLabel;
        }

        let index = 1;
        while (hasTemplateLabel(`${normalizedBaseLabel}(${index})`, templates)) {
            index += 1;
        }

        return `${normalizedBaseLabel}(${index})`;
    }

    function getTemplateEditorDraftContent() {
        const $textarea = $(SELECTORS.templateEditorTextarea);
        if (!$textarea.length) {
            return templateEditorState ? templateEditorState.originalContent : '';
        }

        return String($textarea.val() ?? '');
    }

    function getTemplateEditorDraftLabel() {
        const $input = $(SELECTORS.templateEditorLabelInput);
        if (!$input.length) {
            return templateEditorState ? templateEditorState.originalLabel : '';
        }

        return String($input.val() ?? '');
    }

    function isTemplateDeleteMode() {
        return Boolean(templateEditorState) && templateEditorState.mode === TEMPLATE_EDITOR_MODE_DELETE;
    }

    function resetTemplateEditorUi() {
        $(SELECTORS.templateEditorTitle).text('编辑模板');
        $(SELECTORS.templateEditorLabelInput)
            .val('')
            .prop('readonly', false)
            .attr('placeholder', '请输入模板名称');
        $(SELECTORS.templateEditorTextarea)
            .val('')
            .prop('readonly', false)
            .attr('placeholder', '请输入模板内容');
        $(SELECTORS.templateEditorDeletePanel).hide();
        $(SELECTORS.templateEditorDeleteSkipCheckbox).prop('checked', false);
        $(SELECTORS.templateEditorSaveButton).text('保存');
        $(SELECTORS.templateEditorExitButton).text('退出');
    }

    function showTemplateBrowseView() {
        $(SELECTORS.templateBrowseView).show();
        $(SELECTORS.templateEditorView).hide();
    }

    function showTemplateEditorView() {
        $(SELECTORS.templateBrowseView).hide();
        $(SELECTORS.templateEditorView).show();
    }

    function leaveTemplateEditor() {
        templateEditorState = null;
        resetTemplateEditorUi();
        showTemplateBrowseView();
    }

    function isTemplateEditorDirty() {
        if (!templateEditorState || isTemplateDeleteMode()) {
            return false;
        }

        return Boolean(templateEditorState) && (
            getTemplateEditorDraftContent() !== templateEditorState.originalContent
            || getTemplateEditorDraftLabel() !== templateEditorState.originalLabel
        );
    }

    async function confirmExitTemplateEditorIfDirty() {
        if (!isTemplateEditorDirty()) {
            return true;
        }

        return await askConfirmDialog('退出编辑', '当前模板内容尚未保存，确定退出吗？');
    }

    function syncTemplateEditorState() {
        if (!templateEditorState) {
            showTemplateBrowseView();
            resetTemplateEditorUi();
            return;
        }

        const template = findTemplateById(templateEditorState.templateId);
        if (!template) {
            leaveTemplateEditor();
            return;
        }

        const isDeleteMode = isTemplateDeleteMode();
        $(SELECTORS.templateEditorTitle).text(`${isDeleteMode ? '删除模板' : '编辑模板'}：${template.label}`);
        $(SELECTORS.templateEditorLabelInput)
            .val(template.label)
            .prop('readonly', isDeleteMode)
            .attr('placeholder', isDeleteMode ? '' : '请输入模板名称');
        $(SELECTORS.templateEditorTextarea)
            .val(template.content)
            .prop('readonly', isDeleteMode)
            .attr('placeholder', isDeleteMode ? '' : '请输入模板内容');
        $(SELECTORS.templateEditorDeletePanel).toggle(isDeleteMode);
        $(SELECTORS.templateEditorDeleteSkipCheckbox).prop('checked', isDeleteMode && Boolean(templateEditorState.skipFutureDeleteConfirm));
        $(SELECTORS.templateEditorSaveButton).text(isDeleteMode ? '删除' : '保存');
        $(SELECTORS.templateEditorExitButton).text(isDeleteMode ? '取消' : '退出');
        showTemplateEditorView();
    }

    function setTemplatePresetDrawerOpen(isOpen) {
        templatePresetDrawerOpen = Boolean(isOpen);
        const $button = $(SELECTORS.templatePresetCurrentButton);
        const $options = $(SELECTORS.templatePresetOptions);

        $button.toggleClass('is-open', templatePresetDrawerOpen);
        $button.attr('aria-expanded', String(templatePresetDrawerOpen));
        $options.toggle(templatePresetDrawerOpen);
    }

    function closeTemplatePresetDrawer() {
        setTemplatePresetDrawerOpen(false);
    }

    function toggleTemplatePresetDrawer() {
        setTemplatePresetDrawerOpen(!templatePresetDrawerOpen);
    }

    function syncTemplatePresetUi() {
        const $button = $(SELECTORS.templatePresetCurrentButton);
        const $options = $(SELECTORS.templatePresetOptions);
        if (!$button.length || !$options.length) {
            return;
        }

        const settings = loadSettings();
        const currentPreset = getCurrentTemplatePreset(settings);
        const currentPresetName = currentPreset ? currentPreset.name : DEFAULT_PRESET_NAME;
        $button.find('.my-topbar-test-template-preset-current-name').text(currentPresetName);
        $button.attr('title', `当前预设：${currentPresetName}`);
        $button.attr('aria-label', `当前预设：${currentPresetName}`);

        const otherPresets = getTemplatePresets(settings).filter(item => !currentPreset || item.id !== currentPreset.id);
        if (otherPresets.length === 0) {
            $options.html(`
                <div class="my-topbar-test-template-preset-empty">
                    暂无其他预设
                </div>
            `);
        } else {
            $options.html(otherPresets.map(item => `
                <button type="button"
                        class="menu_button my-topbar-test-template-preset-option"
                        data-preset-id="${escapeHtml(item.id)}"
                        title="切换到预设：${escapeHtml(item.name)}"
                        aria-label="切换到预设：${escapeHtml(item.name)}">
                    ${escapeHtml(item.name)}
                </button>
            `).join(''));
        }

        setTemplatePresetDrawerOpen(templatePresetDrawerOpen);
    }

    async function showTemplateActionDialog(options) {
        const title = String(options?.title ?? '提示');
        const message = String(options?.message ?? '');
        const checkboxLabel = String(options?.checkboxLabel ?? '').trim();
        const buttons = Array.isArray(options?.buttons) && options.buttons.length > 0
            ? options.buttons
            : [{ value: 'confirm', label: '确认', primary: true }];

        return await new Promise(resolve => {
            const $dialog = $(`
                <div class="my-topbar-test-action-dialog-overlay">
                    <div class="my-topbar-test-action-dialog-card" role="dialog" aria-modal="true">
                        <div class="my-topbar-test-action-dialog-title"></div>
                        <div class="my-topbar-test-action-dialog-message"></div>
                        <label class="my-topbar-test-action-dialog-checkbox" style="display: none;">
                            <input type="checkbox" class="my-topbar-test-action-dialog-checkbox-input">
                            <span class="my-topbar-test-action-dialog-checkbox-text"></span>
                        </label>
                        <div class="my-topbar-test-action-dialog-actions"></div>
                    </div>
                </div>
            `);

            $dialog.find('.my-topbar-test-action-dialog-title').text(title);
            $dialog.find('.my-topbar-test-action-dialog-message').text(message);

            if (checkboxLabel) {
                $dialog.find('.my-topbar-test-action-dialog-checkbox').show();
                $dialog.find('.my-topbar-test-action-dialog-checkbox-text').text(checkboxLabel);
            }

            const $actions = $dialog.find('.my-topbar-test-action-dialog-actions');
            buttons.forEach(button => {
                const label = String(button?.label ?? button?.value ?? '确认');
                const value = String(button?.value ?? label);
                const $button = $(
                    `<button type="button" class="menu_button my-topbar-test-action-dialog-button"></button>`
                );
                $button.text(label);
                $button.attr('data-dialog-action', value);
                $button.toggleClass('is-primary', Boolean(button?.primary));
                $actions.append($button);
            });

            const finalize = (action) => {
                const checked = $dialog.find('.my-topbar-test-action-dialog-checkbox-input').is(':checked');
                $dialog.remove();
                resolve({
                    action,
                    checked,
                });
            };

            $dialog.find('.my-topbar-test-action-dialog-button').on('click', function () {
                finalize(String($(this).attr('data-dialog-action') ?? 'cancel'));
            });
            $dialog.find('.my-topbar-test-action-dialog-card').on('click', function (event) {
                event.stopPropagation();
            });

            $('body').append($dialog);
        });
    }

    function showMobileLongPressTip(target, text) {
        $('.my-topbar-test-mobile-longpress-tip').remove();
        const $tip = $('<div class="my-topbar-test-mobile-longpress-tip"></div>');
        $tip.text(String(text ?? ''));
        $('body').append($tip);

        const targetRect = target.getBoundingClientRect();
        const tipRect = $tip.get(0)?.getBoundingClientRect();
        const tipWidth = tipRect?.width || 0;
        const tipHeight = tipRect?.height || 0;
        const left = Math.max(12, Math.min(targetRect.left + (targetRect.width / 2) - (tipWidth / 2), window.innerWidth - tipWidth - 12));
        const top = Math.max(12, targetRect.top - tipHeight - 10);

        $tip.css({
            left: `${left + window.scrollX}px`,
            top: `${top + window.scrollY}px`,
        });

        window.setTimeout(() => {
            $tip.fadeOut(160, () => {
                $tip.remove();
            });
        }, 1200);
    }

    function resetMobileLongPressState() {
        if (mobileLongPressState.timerId) {
            window.clearTimeout(mobileLongPressState.timerId);
        }

        mobileLongPressState = {
            timerId: 0,
            pointerId: null,
            startX: 0,
            startY: 0,
            shown: false,
            suppressClick: mobileLongPressState.shown,
        };
    }

    function beginMobileLongPressTip(pointerId, startX, startY, target, text) {
        resetMobileLongPressState();
        mobileLongPressState.pointerId = pointerId;
        mobileLongPressState.startX = startX;
        mobileLongPressState.startY = startY;
        mobileLongPressState.timerId = window.setTimeout(() => {
            mobileLongPressState.shown = true;
            mobileLongPressState.suppressClick = true;
            showMobileLongPressTip(target, text);
        }, 450);
    }

    function consumeMobileLongPressClickSuppression() {
        if (!mobileLongPressState.suppressClick) {
            return false;
        }

        mobileLongPressState.suppressClick = false;
        return true;
    }

    async function askTextInputDialog(title, message, defaultValue = '') {
        try {
            if (Popup && Popup.show && typeof Popup.show.input === 'function') {
                const result = await Popup.show.input(title, message, defaultValue);
                return result === null || result === undefined ? null : String(result);
            }
        } catch (error) {
            console.warn(`[${MODULE_NAME}] Popup.input 调用失败，改用原生 prompt。`, error);
        }

        const result = window.prompt(`${title}\n\n${message}`, defaultValue);
        return result === null ? null : String(result);
    }

    async function switchTemplatePreset(presetId) {
        const settings = loadSettings();
        const nextPresetIndex = findPresetIndexById(presetId, settings);
        if (nextPresetIndex === -1 || settings.currentTemplatePresetId === presetId) {
            closeTemplatePresetDrawer();
            return;
        }

        const confirmed = await confirmExitTemplateEditorIfDirty();
        if (!confirmed) {
            return;
        }

        leaveTemplateEditor();
        settings.currentTemplatePresetId = settings.templatePresets[nextPresetIndex].id;
        savePluginSettings();
        closeTemplatePresetDrawer();
        renderTemplateList();
        syncOutputFromSelectedTemplates();
        showMessage('success', `已切换到预设“${settings.templatePresets[nextPresetIndex].name}”。`);
    }

    async function addTemplatePreset() {
        const confirmed = await confirmExitTemplateEditorIfDirty();
        if (!confirmed) {
            return;
        }

        const settings = loadSettings();
        const presetName = getUniquePresetName(DEFAULT_PRESET_NAME, settings.templatePresets);
        const preset = createDefaultPreset(presetName);
        settings.templatePresets.push(preset);
        settings.currentTemplatePresetId = preset.id;

        leaveTemplateEditor();
        savePluginSettings();
        closeTemplatePresetDrawer();
        renderTemplateList();
        syncOutputFromSelectedTemplates();
        showMessage('success', `已新增预设“${presetName}”。`);
    }

    async function renameCurrentTemplatePreset() {
        const settings = loadSettings();
        const currentPreset = getCurrentTemplatePreset(settings);
        if (!currentPreset) {
            return;
        }

        const nextNameInput = await askTextInputDialog('重命名预设', '请输入新的预设名称。', currentPreset.name);
        if (nextNameInput === null) {
            return;
        }

        const trimmedName = nextNameInput.trim();
        if (!trimmedName) {
            showMessage('warning', '预设名称不能为空。');
            return;
        }

        const nextName = getUniquePresetName(trimmedName, settings.templatePresets, currentPreset.id);
        currentPreset.name = nextName;
        savePluginSettings();
        renderTemplateList();
        showMessage('success', `预设已重命名为“${nextName}”。`);
    }

    async function deleteCurrentTemplatePreset() {
        const settings = loadSettings();
        const currentPreset = getCurrentTemplatePreset(settings);
        if (!currentPreset) {
            return;
        }

        const confirmed = await confirmExitTemplateEditorIfDirty();
        if (!confirmed) {
            return;
        }

        const deleteDialogResult = await showTemplateActionDialog({
            title: '删除预设',
            message: `确认删除当前预设“${currentPreset.name}”吗？`,
            buttons: [
                { value: 'cancel', label: '取消' },
                { value: 'confirm', label: '确认', primary: true },
            ],
        });
        if (deleteDialogResult.action !== 'confirm') {
            return;
        }

        const currentPresetIndex = findPresetIndexById(currentPreset.id, settings);
        settings.templatePresets = settings.templatePresets.filter(item => item.id !== currentPreset.id);

        if (settings.templatePresets.length === 0) {
            const fallbackPreset = createDefaultPreset();
            settings.templatePresets = [fallbackPreset];
            settings.currentTemplatePresetId = fallbackPreset.id;
        } else {
            const nextPreset = settings.templatePresets[currentPresetIndex]
                || settings.templatePresets[currentPresetIndex - 1]
                || settings.templatePresets[0];
            settings.currentTemplatePresetId = nextPreset.id;
        }

        leaveTemplateEditor();
        savePluginSettings();
        closeTemplatePresetDrawer();
        renderTemplateList();
        syncOutputFromSelectedTemplates();
        showMessage('success', `已删除预设“${currentPreset.name}”。`);
    }

    async function openTemplateEditor(templateId) {
        const template = findTemplateById(templateId);
        if (!template) {
            showMessage('warning', '没有找到要编辑的模板。');
            return;
        }

        if (
            templateEditorState
            && (
                templateEditorState.templateId !== templateId
                || templateEditorState.mode !== TEMPLATE_EDITOR_MODE_EDIT
            )
        ) {
            const confirmed = await confirmExitTemplateEditorIfDirty();
            if (!confirmed) {
                return;
            }
        }

        closeTemplatePresetDrawer();

        if (
            !templateEditorState
            || templateEditorState.templateId !== templateId
            || templateEditorState.mode !== TEMPLATE_EDITOR_MODE_EDIT
        ) {
            templateEditorState = {
                templateId: template.id,
                originalLabel: template.label,
                originalContent: template.content,
                mode: TEMPLATE_EDITOR_MODE_EDIT,
            };
        }

        syncTemplateEditorState();

        const $textarea = $(SELECTORS.templateEditorTextarea);
        if ($textarea.length) {
            $textarea.trigger('focus');

            const element = $textarea.get(0);
            if (element && typeof element.setSelectionRange === 'function') {
                const len = element.value.length;
                element.setSelectionRange(len, len);
            }
        }
    }

    async function handleTemplateEditorExit() {
        const confirmed = await confirmExitTemplateEditorIfDirty();
        if (!confirmed) {
            return;
        }

        leaveTemplateEditor();
    }

    async function handleTemplateEditorSave() {
        if (!templateEditorState) {
            return;
        }

        if (isTemplateDeleteMode()) {
            templateDeleteConfirmState.skipForSession = $(SELECTORS.templateEditorDeleteSkipCheckbox).is(':checked');
            await deleteTemplateById(templateEditorState.templateId);
            return;
        }

        const template = findTemplateById(templateEditorState.templateId);
        if (!template) {
            leaveTemplateEditor();
            showMessage('warning', '没有找到要保存的模板。');
            return;
        }

        const nextLabel = getTemplateEditorDraftLabel().trim();
        if (!nextLabel) {
            showMessage('warning', '模板名称不能为空。');
            return;
        }

        template.label = nextLabel;
        template.content = getTemplateEditorDraftContent();
        templateEditorState.originalLabel = template.label;
        templateEditorState.originalContent = template.content;

        savePluginSettings();
        renderTemplateList();
        syncOutputFromSelectedTemplates();
        $(SELECTORS.templateEditorTitle).text(`编辑模板：${template.label}`);
        showMessage('success', '模板名称和内容已保存。');
    }

    function addTemplate() {
        const settings = loadSettings();
        const currentPreset = getCurrentTemplatePreset(settings);
        if (!currentPreset) {
            return;
        }

        const label = getNextDefaultTemplateLabel(currentPreset.templates);
        currentPreset.templates.push({
            id: createTemplateId(currentPreset.templates.length),
            label,
            content: '',
        });

        savePluginSettings();
        renderTemplateList();
        showMessage('success', `已新增模板“${label}”。`);
    }

    function downloadTextFile(fileName, text, mimeType) {
        const blob = new Blob([text], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        window.setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 0);
    }

    function buildPresetExportPayload(preset) {
        const selectedTemplateIdSet = new Set(preset.selectedTemplateIds);
        return {
            type: 'my_topbar_test_template_preset',
            name: preset.name,
            templates: preset.templates.map((item, index) => ({
                label: item.label,
                content: item.content,
                sortIndex: index,
                selected: selectedTemplateIdSet.has(item.id),
            })),
        };
    }

    function buildTemplateExportPayload(templates) {
        return {
            type: 'my_topbar_test_templates',
            templates: templates.map((item, index) => ({
                label: item.label,
                content: item.content,
                sortIndex: index,
            })),
        };
    }

    async function exportTemplateData() {
        const settings = loadSettings();
        const currentPreset = getCurrentTemplatePreset(settings);
        if (!currentPreset) {
            showMessage('warning', '当前没有可导出的预设。');
            return;
        }

        const dialogResult = await showTemplateActionDialog({
            title: '导出模板预设',
            message: '请选择导出内容。',
            buttons: [
                { value: 'cancel', label: '取消' },
                { value: 'templates', label: '导出当前选定模板' },
                { value: 'preset', label: '导出当前预设', primary: true },
            ],
        });

        if (dialogResult.action === 'cancel') {
            return;
        }

        try {
            if (dialogResult.action === 'preset') {
                const fileContent = JSON.stringify(buildPresetExportPayload(currentPreset), null, 2);
                downloadTextFile(`${currentPreset.name}.json`, fileContent, 'application/json;charset=utf-8');
                showMessage('success', `已导出预设“${currentPreset.name}”。`);
                return;
            }

            const selectedTemplates = getSelectedTemplateList(settings);
            if (selectedTemplates.length === 0) {
                showMessage('warning', '请先选定要导出的模板。');
                return;
            }

            const fileContent = JSON.stringify(buildTemplateExportPayload(selectedTemplates), null, 2);
            const fileName = selectedTemplates.length === 1
                ? `${selectedTemplates[0].label}.json`
                : '已选模板.json';
            downloadTextFile(fileName, fileContent, 'application/json;charset=utf-8');
            showMessage('success', `已导出 ${selectedTemplates.length} 个模板。`);
        } catch (error) {
            console.error(`[${MODULE_NAME}] 导出模板预设失败`, error);
            showMessage('error', '导出模板预设失败。');
        }
    }

    function triggerTemplateImport() {
        const $input = $(SELECTORS.templateImportInput);
        if (!$input.length) {
            showMessage('error', '导入控件未加载。');
            return;
        }

        $input.val('');

        const element = $input.get(0);
        if (element && typeof element.click === 'function') {
            element.click();
        }
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => resolve(String(reader.result ?? ''));
            reader.onerror = () => reject(reader.error || new Error('读取文件失败。'));

            reader.readAsText(file, 'utf-8');
        });
    }

    function normalizeImportedTemplateEntries(rawTemplates, fileName = '', includeSelected = false) {
        if (!Array.isArray(rawTemplates)) {
            throw new Error('导入失败：模板列表格式不正确。');
        }

        return rawTemplates.map((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item) || !Object.prototype.hasOwnProperty.call(item, 'content')) {
                throw new Error('导入失败：模板数据缺少 content 字段。');
            }

            if (item.content !== null && typeof item.content !== 'string') {
                throw new Error('导入失败：content 必须是字符串。');
            }

            const fallbackLabel = index === 0 ? (stripFileExtension(fileName) || '模板') : `模板${index + 1}`;
            return {
                label: String(item.label ?? item.name ?? fallbackLabel).trim() || fallbackLabel,
                content: String(item.content ?? ''),
                selected: includeSelected && Boolean(item.selected),
            };
        });
    }

    function detectImportedTemplatePayload(parsed, fileName = '') {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('导入失败：JSON 格式不正确。');
        }

        if (Array.isArray(parsed.templates)) {
            const type = String(parsed.type ?? '').trim();
            if (type === 'my_topbar_test_template_preset' || Object.prototype.hasOwnProperty.call(parsed, 'name')) {
                return {
                    type: 'preset',
                    name: String(parsed.name ?? parsed.label ?? stripFileExtension(fileName) ?? '').trim() || DEFAULT_PRESET_NAME,
                    templates: normalizeImportedTemplateEntries(parsed.templates, fileName, true),
                };
            }

            return {
                type: 'templates',
                templates: normalizeImportedTemplateEntries(parsed.templates, fileName, false),
            };
        }

        if (Object.prototype.hasOwnProperty.call(parsed, 'content')) {
            if (parsed.content !== null && typeof parsed.content !== 'string') {
                throw new Error('导入失败：content 必须是字符串。');
            }

            const fallbackLabel = stripFileExtension(fileName) || '模板';
            return {
                type: 'templates',
                templates: [{
                    label: String(parsed.label ?? fallbackLabel).trim() || fallbackLabel,
                    content: String(parsed.content ?? ''),
                    selected: false,
                }],
            };
        }

        throw new Error('导入失败：无法识别导入内容。');
    }

    function createPresetFromImportedPayload(payload, settings) {
        const templates = [];
        const selectedTemplateIds = [];

        payload.templates.forEach(item => {
            const nextLabel = getNextImportedTemplateLabel(item.label, templates);
            const template = {
                id: createTemplateId(templates.length),
                label: nextLabel,
                content: item.content,
            };
            templates.push(template);
            if (item.selected) {
                selectedTemplateIds.push(template.id);
            }
        });

        return {
            id: createPresetId(settings.templatePresets.length),
            name: getUniquePresetName(payload.name, settings.templatePresets),
            templates,
            selectedTemplateIds,
        };
    }

    async function importTemplateFromFile(file) {
        if (!file) {
            return;
        }

        try {
            if (!String(file.name ?? '').toLowerCase().endsWith('.json')) {
                throw new Error('导入失败：请选择 JSON 文件。');
            }

            const fileText = await readFileAsText(file);
            const parsed = JSON.parse(fileText);
            const payload = detectImportedTemplatePayload(parsed, file.name);
            const settings = loadSettings();

            if (payload.type === 'preset') {
                const preset = createPresetFromImportedPayload(payload, settings);
                settings.templatePresets.push(preset);
                savePluginSettings();
                renderTemplateList();
                showMessage('success', `已导入预设“${preset.name}”。`);
                return;
            }

            const confirmed = await askConfirmDialog('导入模板', '模板会导入当前预设是否确认');
            if (!confirmed) {
                return;
            }

            const currentPreset = getCurrentTemplatePreset(settings);
            if (!currentPreset) {
                throw new Error('导入失败：没有找到当前预设。');
            }

            payload.templates.forEach(item => {
                const nextLabel = getNextImportedTemplateLabel(item.label, currentPreset.templates);
                currentPreset.templates.push({
                    id: createTemplateId(currentPreset.templates.length),
                    label: nextLabel,
                    content: item.content,
                });
            });

            savePluginSettings();
            renderTemplateList();
            showMessage('success', `已导入 ${payload.templates.length} 个模板。`);
        } catch (error) {
            console.error(`[${MODULE_NAME}] 导入模板预设失败`, error);
            showMessage('error', error instanceof Error ? error.message : '导入模板预设失败。');
        } finally {
            $(SELECTORS.templateImportInput).val('');
        }
    }

    function applyTemplateText(templateText, currentText) {
        const normalizedTemplateText = String(templateText ?? '');
        const normalizedCurrentText = String(currentText ?? '');

        if (normalizedTemplateText.includes('{{text}}')) {
            return normalizedTemplateText.replace(/\{\{text\}\}/g, normalizedCurrentText);
        }

        if (!normalizedCurrentText.trim()) {
            return normalizedTemplateText;
        }

        if (!normalizedTemplateText.trim()) {
            return normalizedCurrentText;
        }

        return `${normalizedTemplateText}\n\n${normalizedCurrentText}`;
    }

    function buildOutputFromSelectedTemplates(baseText, settings = loadSettings()) {
        const selectedTemplates = getSelectedTemplateList(settings);
        let nextText = String(baseText ?? '');

        for (let i = selectedTemplates.length - 1; i >= 0; i--) {
            nextText = applyTemplateText(selectedTemplates[i].content, nextText);
        }

        return nextText;
    }

    function syncOutputFromSelectedTemplates(shouldFocus = false) {
        const settings = loadSettings();
        const nextText = buildOutputFromSelectedTemplates(extractedBaseText, settings);

        setOutputText(nextText);

        if (shouldFocus) {
            focusOutputTextarea();
        }
    }

    function toggleTemplateSelection(templateId) {
        const template = findTemplateById(templateId);
        if (!template) {
            showMessage('warning', '没有找到对应的模板。');
            return;
        }

        const settings = loadSettings();
        const currentPreset = getCurrentTemplatePreset(settings);
        if (!currentPreset) {
            return;
        }

        const selectedTemplateIds = currentPreset.selectedTemplateIds;
        const selectedIndex = selectedTemplateIds.indexOf(templateId);

        if (selectedIndex === -1) {
            selectedTemplateIds.push(templateId);
        } else {
            selectedTemplateIds.splice(selectedIndex, 1);
        }

        savePluginSettings();
        renderTemplateList();
        syncOutputFromSelectedTemplates();
    }

    async function deleteTemplateById(templateId) {
        const settings = loadSettings();
        const currentPreset = getCurrentTemplatePreset(settings);
        if (!currentPreset) {
            return;
        }

        const template = currentPreset.templates.find(item => item.id === templateId) || null;
        if (!template) {
            showMessage('warning', '没有找到要删除的模板。');
            return;
        }

        currentPreset.templates = currentPreset.templates.filter(item => item.id !== templateId);
        currentPreset.selectedTemplateIds = currentPreset.selectedTemplateIds.filter(id => id !== templateId);
        if (templateEditorState && templateEditorState.templateId === templateId) {
            leaveTemplateEditor();
        }

        savePluginSettings();
        renderTemplateList();
        syncOutputFromSelectedTemplates();
        showMessage('success', '模板已删除。');
    }

    async function openTemplateDeleteView(templateId) {
        const template = findTemplateById(templateId);
        if (!template) {
            showMessage('warning', '没有找到要删除的模板。');
            return;
        }

        if (templateDeleteConfirmState.skipForSession) {
            await deleteTemplateById(templateId);
            return;
        }

        if (
            templateEditorState
            && (
                templateEditorState.templateId !== templateId
                || templateEditorState.mode !== TEMPLATE_EDITOR_MODE_EDIT
            )
        ) {
            const confirmed = await confirmExitTemplateEditorIfDirty();
            if (!confirmed) {
                return;
            }
        }

        closeTemplatePresetDrawer();

        if (
            !templateEditorState
            || templateEditorState.templateId !== templateId
            || templateEditorState.mode !== TEMPLATE_EDITOR_MODE_DELETE
        ) {
            templateEditorState = {
                templateId: template.id,
                originalLabel: template.label,
                originalContent: template.content,
                mode: TEMPLATE_EDITOR_MODE_DELETE,
                skipFutureDeleteConfirm: false,
            };
        }

        syncTemplateEditorState();
        $(SELECTORS.templateEditorDeleteSkipCheckbox).trigger('focus');
    }

    function getTemplateItemElement(templateId) {
        return $(SELECTORS.templateList)
            .find('.my-topbar-test-template-item')
            .filter(function () {
                return String($(this).attr('data-template-id') ?? '') === String(templateId ?? '');
            })
            .first();
    }

    function consumeTemplateSortClickSuppression() {
        if (!templateSortState.suppressClick) {
            return false;
        }

        templateSortState.suppressClick = false;
        return true;
    }

    function resetTemplateSortState() {
        if (templateSortState.timerId) {
            window.clearTimeout(templateSortState.timerId);
        }

        if (
            templateSortState.captureElement
            && templateSortState.pointerId !== null
            && typeof templateSortState.captureElement.releasePointerCapture === 'function'
        ) {
            try {
                if (typeof templateSortState.captureElement.hasPointerCapture !== 'function' || templateSortState.captureElement.hasPointerCapture(templateSortState.pointerId)) {
                    templateSortState.captureElement.releasePointerCapture(templateSortState.pointerId);
                }
            } catch (error) {
                console.warn(`[${MODULE_NAME}] 释放模板拖拽指针捕获失败`, error);
            }
        }

        const shouldSuppressClick = templateSortState.suppressClick || templateSortState.isDragging;

        templateSortState = {
            timerId: 0,
            pointerId: null,
            startX: 0,
            startY: 0,
            templateId: '',
            isDragging: false,
            dragOffsetX: 0,
            dragOffsetY: 0,
            suppressClick: shouldSuppressClick,
            captureElement: null,
        };

        $('body').removeClass('my-topbar-test-template-dragging');
        $(SELECTORS.templateList)
            .find('.my-topbar-test-template-item')
            .removeClass('is-dragging')
            .css({
                '--my-topbar-test-drag-x': '',
                '--my-topbar-test-drag-y': '',
                '--my-topbar-test-drag-origin-x': '',
                '--my-topbar-test-drag-origin-y': '',
            });
    }

    function beginTemplateSortPress(templateId, pointerId, startX, startY, captureElement = null) {
        resetTemplateSortState();
        templateSortState.pointerId = pointerId;
        templateSortState.startX = startX;
        templateSortState.startY = startY;
        templateSortState.templateId = String(templateId ?? '');
        templateSortState.captureElement = captureElement;
        templateSortState.timerId = window.setTimeout(() => {
            const $item = getTemplateItemElement(templateSortState.templateId);
            if (!$item.length) {
                resetTemplateSortState();
                return;
            }

            const rect = $item.get(0)?.getBoundingClientRect();
            templateSortState.isDragging = true;
            templateSortState.suppressClick = true;
            templateSortState.dragOffsetX = rect ? templateSortState.startX - rect.left : 0;
            templateSortState.dragOffsetY = rect ? templateSortState.startY - rect.top : 0;

            if (
                templateSortState.captureElement
                && templateSortState.pointerId !== null
                && typeof templateSortState.captureElement.setPointerCapture === 'function'
            ) {
                try {
                    templateSortState.captureElement.setPointerCapture(templateSortState.pointerId);
                } catch (error) {
                    console.warn(`[${MODULE_NAME}] 设置模板拖拽指针捕获失败`, error);
                }
            }

            $item
                .addClass('is-dragging')
                .css({
                    '--my-topbar-test-drag-origin-x': `${templateSortState.dragOffsetX}px`,
                    '--my-topbar-test-drag-origin-y': `${templateSortState.dragOffsetY}px`,
                });
            $('body').addClass('my-topbar-test-template-dragging');
        }, 320);
    }

    function updateDraggedTemplatePosition(clientX, clientY) {
        if (!templateSortState.isDragging) {
            return;
        }

        const $item = getTemplateItemElement(templateSortState.templateId);
        if (!$item.length) {
            return;
        }

        const offsetX = clientX - templateSortState.startX;
        const offsetY = clientY - templateSortState.startY;
        $item.css({
            '--my-topbar-test-drag-x': `${offsetX}px`,
            '--my-topbar-test-drag-y': `${offsetY}px`,
        });
    }

    function maybeMoveDraggedTemplate(clientX, clientY) {
        if (!templateSortState.isDragging) {
            return;
        }

        const draggedItem = getTemplateItemElement(templateSortState.templateId).get(0);
        const listElement = $(SELECTORS.templateList).get(0);
        if (!draggedItem || !listElement) {
            return;
        }

        const target = document.elementFromPoint(clientX, clientY)?.closest('.my-topbar-test-template-item');
        if (!target || target === draggedItem || target.parentElement !== listElement) {
            return;
        }

        const targetRect = target.getBoundingClientRect();
        const shouldInsertAfter = clientY >= targetRect.top + (targetRect.height / 2);
        listElement.insertBefore(draggedItem, shouldInsertAfter ? target.nextElementSibling : target);
    }

    function finalizeTemplateSort() {
        if (!templateSortState.isDragging) {
            resetTemplateSortState();
            return;
        }

        const settings = loadSettings();
        const currentPreset = getCurrentTemplatePreset(settings);
        if (!currentPreset) {
            resetTemplateSortState();
            return;
        }

        const orderedTemplateIds = $(SELECTORS.templateList)
            .find('.my-topbar-test-template-item')
            .map(function () {
                return String($(this).attr('data-template-id') ?? '');
            })
            .get();

        const templateMap = new Map(currentPreset.templates.map(item => [item.id, item]));
        currentPreset.templates = orderedTemplateIds
            .map(id => templateMap.get(id) || null)
            .filter(Boolean);

        savePluginSettings();
        renderTemplateList();
        syncOutputFromSelectedTemplates();
        resetTemplateSortState();
    }

    function renderTemplateList() {
        const $list = $(SELECTORS.templateList);
        if (!$list.length) {
            return;
        }

        const settings = loadSettings();
        const currentPreset = getCurrentTemplatePreset(settings);
        const templates = Array.isArray(currentPreset?.templates) ? currentPreset.templates : [];
        const selectedTemplateIdSet = new Set(currentPreset?.selectedTemplateIds || []);
        syncTemplatePresetUi();

        if (templates.length === 0) {
            $list.html(`
                <div class="my-topbar-test-template-empty">
                    当前预设里还没有模板。
                </div>
            `);
            return;
        }

        const html = templates.map(item => {
            const templateId = escapeHtml(item.id);
            const label = escapeHtml(item.label);
            const isSelected = selectedTemplateIdSet.has(item.id);

            return `
                <div class="my-topbar-test-template-item${isSelected ? ' is-selected' : ''}" data-template-id="${templateId}">
                    <div class="my-topbar-test-template-main">
                        <div class="my-topbar-test-template-combo">
                            <button type="button"
                                    class="menu_button my-topbar-test-template-apply${isSelected ? ' is-selected' : ''}"
                                    data-template-id="${templateId}"
                                    title="点击切换选定状态，长按拖拽排序"
                                    aria-label="模板：${label}；点击切换选定状态，长按拖拽排序"
                                    aria-pressed="${isSelected ? 'true' : 'false'}">
                                ${label}
                            </button>

                            <div class="my-topbar-test-template-item-actions">
                                <button type="button"
                                        class="menu_button my-topbar-test-template-icon-button my-topbar-test-template-edit-button"
                                        data-template-id="${templateId}"
                                        title="编辑模板"
                                        aria-label="编辑模板：${label}">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                                <button type="button"
                                        class="menu_button my-topbar-test-template-icon-button my-topbar-test-template-delete-button"
                                        data-template-id="${templateId}"
                                        title="删除模板"
                                        aria-label="删除模板：${label}">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        $list.html(html);
    }

    function getPanelHtml() {
        return `
            <div id="my-topbar-test-panel" class="my-topbar-test-fullscreen-overlay" style="display: none;">
                <div class="my-topbar-test-container">
                    <div id="my-topbar-test-close-btn" class="my-topbar-test-close-btn" title="关闭面板">
                        <i class="fa-solid fa-times"></i>
                    </div>

                    <div id="my-topbar-test-mobile-tabs" class="my-topbar-test-mobile-tabs">
                        <button id="my-topbar-test-mobile-back"
                                class="menu_button my-topbar-test-mobile-back"
                                type="button"
                                aria-label="返回功能菜单">
                            <i class="fa-solid fa-chevron-left"></i> 返回
                        </button>
                        <div class="my-topbar-test-mobile-tab-buttons">
                            <button id="my-topbar-test-mobile-tab-menu"
                                    class="menu_button my-topbar-test-mobile-tab active"
                                    type="button"
                                    aria-pressed="true">
                                功能菜单
                            </button>
                            <button id="my-topbar-test-mobile-tab-output"
                                    class="menu_button my-topbar-test-mobile-tab"
                                    type="button"
                                    aria-pressed="false">
                                截取与输出
                            </button>
                        </div>
                    </div>

                    <div class="my-topbar-test-col-left">
                        <div class="my-topbar-test-section-title">功能菜单</div>
                        
                        <button id="my-topbar-test-range-toggle"
                                class="menu_button my-topbar-test-menu-btn active"
                                type="button">
                            <i class="fa-solid fa-code"></i> 设置范围
                        </button>

                        <button id="my-topbar-test-template-toggle"
                                class="menu_button my-topbar-test-menu-btn"
                                type="button">
                            <i class="fa-solid fa-layer-group"></i> 模板预设
                        </button>

                        <button id="my-topbar-test-capture-send-toggle"
                                class="menu_button my-topbar-test-menu-btn"
                                type="button">
                            <i class="fa-solid fa-paper-plane"></i> 截取与发送
                        </button>

                        <button id="my-topbar-test-api-toggle"
                                class="menu_button my-topbar-test-menu-btn"
                                type="button">
                            <i class="fa-solid fa-link"></i> api链接
                        </button>

                        <button id="my-topbar-test-floating-toggle"
                                class="menu_button my-topbar-test-menu-btn"
                                type="button">
                            <i class="fa-solid fa-hand-pointer"></i> 悬浮窗设置
                        </button>

                    </div>

                    <div class="my-topbar-test-col-middle">
                        <div class="my-topbar-test-section-title">设置详情</div>

                        <div id="my-topbar-test-range-settings" class="my-topbar-test-settings-section">
                            <label for="my-topbar-test-keep-tags" class="my-topbar-test-keep-tags-row">
                                <input id="my-topbar-test-keep-tags"
                                       class="my-topbar-test-keep-tags-checkbox"
                                       type="checkbox">
                                <span class="my-topbar-test-keep-tags-text">保留标签</span>
                            </label>

                            <label for="my-topbar-test-only-replace-in-tags" class="my-topbar-test-keep-tags-row my-topbar-test-only-replace-row">
                                <input id="my-topbar-test-only-replace-in-tags"
                                       class="my-topbar-test-keep-tags-checkbox"
                                       type="checkbox"
                                       disabled>
                                <span class="my-topbar-test-keep-tags-text">仅替换标签内</span>
                            </label>

                            <div class="my-topbar-test-range-only-replace-tip">
                                勾选仅替换标签内,只会替换聊天记录相同的标签内的内容<br>
                                找不到标签,无法替换的内容会输出到截取框末尾.
                            </div>

                            <div class="my-topbar-test-range-row">
                                <label for="my-topbar-test-start-tag" class="my-topbar-test-label">开始标签</label>
                                <div class="my-topbar-test-tag-input-wrap">
                                    <span class="my-topbar-test-tag-prefix">&lt;</span>
                                    <input id="my-topbar-test-start-tag"
                                           class="my-topbar-test-tag-input"
                                           type="text"
                                           placeholder="例如：text"
                                           spellcheck="false"
                                           autocomplete="off">
                                    <span class="my-topbar-test-tag-suffix">&gt;</span>
                                </div>
                            </div>

                            <div class="my-topbar-test-range-row">
                                <label for="my-topbar-test-end-tag" class="my-topbar-test-label">结束标签</label>
                                <div class="my-topbar-test-tag-input-wrap">
                                    <span class="my-topbar-test-tag-prefix">&lt;/</span>
                                    <input id="my-topbar-test-end-tag"
                                           class="my-topbar-test-tag-input"
                                           type="text"
                                           placeholder="例如：text"
                                           spellcheck="false"
                                           autocomplete="off">
                                    <span class="my-topbar-test-tag-suffix">&gt;</span>
                                </div>
                            </div>

                            <div class="my-topbar-test-range-tip">
                                留空时默认截取整条最后消息。<br>
                                例如开始标签填 text，结束标签也填 text，就会截取 &lt;text&gt; 和 &lt;/text&gt; 之间的内容。<br>
                                打开“保留标签”后，输出会连同开始和结束标签一起保留。
                            </div>
                        </div>

                        <div id="my-topbar-test-template-settings" class="my-topbar-test-settings-section" style="display: none;">
                            <div id="my-topbar-test-template-browse-view" class="my-topbar-test-template-browse-view">
                                <div class="my-topbar-test-template-tip">
                                    点击模板切换选定状态，点击右侧图标编辑或删除模板，长按模板按钮可拖拽调整顺序。
                                </div>

                                <div class="my-topbar-test-template-toolbar">
                                    <div class="my-topbar-test-template-preset-bar">
                                        <div class="my-topbar-test-template-preset-drawer">
                                            <button id="my-topbar-test-template-preset-current"
                                                    class="menu_button my-topbar-test-template-preset-current"
                                                    type="button"
                                                    aria-expanded="false">
                                                <span class="my-topbar-test-template-preset-current-name">默认预设</span>
                                                <i class="fa-solid fa-chevron-down"></i>
                                            </button>
                                            <div id="my-topbar-test-template-preset-options"
                                                 class="my-topbar-test-template-preset-options"
                                                 style="display: none;"></div>
                                        </div>

                                        <div class="my-topbar-test-template-preset-actions">
                                            <button id="my-topbar-test-template-delete-preset"
                                                    class="menu_button my-topbar-test-template-icon-button"
                                                    type="button"
                                                    title="删除预设"
                                                    data-long-press-tip="删除预设"
                                                    aria-label="删除预设">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                            <button id="my-topbar-test-template-add-preset"
                                                    class="menu_button my-topbar-test-template-icon-button"
                                                    type="button"
                                                    title="新增预设"
                                                    data-long-press-tip="新增预设"
                                                    aria-label="新增预设">
                                                <i class="fa-solid fa-file-circle-plus"></i>
                                            </button>
                                            <button id="my-topbar-test-template-rename-preset"
                                                    class="menu_button my-topbar-test-template-icon-button"
                                                    type="button"
                                                    title="重命名预设"
                                                    data-long-press-tip="重命名预设"
                                                    aria-label="重命名预设">
                                                <i class="fa-solid fa-pen"></i>
                                            </button>
                                        </div>
                                    </div>

                                    <div class="my-topbar-test-template-tools">
                                        <button id="my-topbar-test-template-add"
                                                class="menu_button my-topbar-test-template-tool-button"
                                                type="button">
                                            添加模板
                                        </button>
                                        <button id="my-topbar-test-template-export"
                                                class="menu_button my-topbar-test-template-tool-button"
                                                type="button">
                                            导出
                                        </button>
                                        <button id="my-topbar-test-template-import"
                                                class="menu_button my-topbar-test-template-tool-button"
                                                type="button">
                                            导入
                                        </button>
                                    </div>
                                </div>

                                <div id="my-topbar-test-template-list" class="my-topbar-test-template-list"></div>
                            </div>

                            <div id="my-topbar-test-template-editor-view" class="my-topbar-test-template-editor-view" style="display: none;">
                                <div id="my-topbar-test-template-editor-title" class="my-topbar-test-template-editor-title">编辑模板</div>
                                <label for="my-topbar-test-template-editor-label" class="my-topbar-test-label">模板名称</label>
                                <input id="my-topbar-test-template-editor-label"
                                       class="text_pole my-topbar-test-template-editor-input"
                                       type="text"
                                       spellcheck="false"
                                       placeholder="请输入模板名称"
                                       autocomplete="off">
                                <label for="my-topbar-test-template-editor-text" class="my-topbar-test-label">模板内容</label>
                                <textarea id="my-topbar-test-template-editor-text"
                                          class="text_pole my-topbar-test-template-editor-textarea"
                                          spellcheck="false"
                                          placeholder="请输入模板内容"></textarea>
                                <div id="my-topbar-test-template-editor-delete-panel" class="my-topbar-test-template-editor-delete-panel" style="display: none;">
                                    <div class="my-topbar-test-template-tip">
                                        确认删除后，此模板会从当前预设中移除。
                                    </div>
                                    <label for="my-topbar-test-template-editor-delete-skip" class="my-topbar-test-keep-tags-row">
                                        <input id="my-topbar-test-template-editor-delete-skip"
                                               class="my-topbar-test-keep-tags-checkbox"
                                               type="checkbox">
                                        <span class="my-topbar-test-keep-tags-text">本次使用不再提示</span>
                                    </label>
                                </div>
                                <div class="my-topbar-test-template-editor-actions">
                                    <button id="my-topbar-test-template-editor-save"
                                            class="menu_button my-topbar-test-template-tool-button"
                                            type="button">
                                        保存
                                    </button>
                                    <button id="my-topbar-test-template-editor-exit"
                                            class="menu_button my-topbar-test-template-tool-button"
                                            type="button">
                                        退出
                                    </button>
                                </div>
                            </div>

                            <input id="my-topbar-test-template-import-input"
                                   type="file"
                                   accept=".json,application/json"
                                   hidden>
                        </div>

                        <div id="my-topbar-test-capture-send-settings" class="my-topbar-test-settings-section" style="display: none;">
                            <div class="my-topbar-test-template-tip">
                                先手动截取，再把当前截取框中的内容复制发送给 AI。发送完成后会弹出确认框，确认后替换当前聊天窗口最后一条消息。
                            </div>

                            <div class="my-topbar-test-capture-send-options">
                                <label for="my-topbar-test-auto-trigger-enabled" class="my-topbar-test-keep-tags-row">
                                    <input id="my-topbar-test-auto-trigger-enabled"
                                           class="my-topbar-test-keep-tags-checkbox"
                                           type="checkbox">
                                    <span class="my-topbar-test-keep-tags-text">开启自动触发</span>
                                </label>

                                <label for="my-topbar-test-skip-reply-confirm" class="my-topbar-test-keep-tags-row">
                                    <input id="my-topbar-test-skip-reply-confirm"
                                           class="my-topbar-test-keep-tags-checkbox"
                                           type="checkbox">
                                    <span class="my-topbar-test-keep-tags-text">跳过确认</span>
                                </label>
                            </div>

                            <div class="my-topbar-test-capture-send-actions">
                                <button id="my-topbar-test-manual-trigger"
                                        class="menu_button my-topbar-test-menu-btn my-topbar-test-trigger-btn"
                                        type="button">
                                    <i class="fa-solid fa-bolt"></i> 手动触发
                                </button>
                                <button id="my-topbar-test-manual-send"
                                        class="menu_button my-topbar-test-menu-btn my-topbar-test-send-btn"
                                        type="button">
                                    <i class="fa-solid fa-paper-plane"></i> 手动发送
                                </button>
                                <button id="my-topbar-test-stop-manual-flow"
                                        class="menu_button my-topbar-test-menu-btn"
                                        type="button">
                                    停止流程
                                </button>
                            </div>
                        </div>

                        <div id="my-topbar-test-api-settings" class="my-topbar-test-settings-section" style="display: none;">
                            <div class="my-topbar-test-api-grid">
                                <div class="my-topbar-test-api-field">
                                    <label for="my-topbar-test-api-temperature" class="my-topbar-test-label">模型温度</label>
                                    <input id="my-topbar-test-api-temperature" class="text_pole my-topbar-test-api-input" type="number" step="0.1" placeholder="1">
                                </div>

                                <div class="my-topbar-test-api-field">
                                    <label for="my-topbar-test-api-top-p" class="my-topbar-test-label">Top-P</label>
                                    <input id="my-topbar-test-api-top-p" class="text_pole my-topbar-test-api-input" type="number" step="0.1" placeholder="1">
                                </div>

                                <div class="my-topbar-test-api-field">
                                    <label for="my-topbar-test-api-top-k" class="my-topbar-test-label">Top-k</label>
                                    <input id="my-topbar-test-api-top-k" class="text_pole my-topbar-test-api-input" type="number" step="1" placeholder="0">
                                </div>

                                <div class="my-topbar-test-api-field">
                                    <label for="my-topbar-test-api-presence-penalty" class="my-topbar-test-label">存在惩罚</label>
                                    <input id="my-topbar-test-api-presence-penalty" class="text_pole my-topbar-test-api-input" type="number" step="0.1" placeholder="0">
                                </div>

                                <div class="my-topbar-test-api-field">
                                    <label for="my-topbar-test-api-frequency-penalty" class="my-topbar-test-label">频率惩罚</label>
                                    <input id="my-topbar-test-api-frequency-penalty" class="text_pole my-topbar-test-api-input" type="number" step="0.1" placeholder="0">
                                </div>

                                 <label for="my-topbar-test-api-stream" class="my-topbar-test-keep-tags-row my-topbar-test-api-stream-row">
                                     <input id="my-topbar-test-api-stream" class="my-topbar-test-keep-tags-checkbox" type="checkbox">
                                     <span class="my-topbar-test-keep-tags-text">流式输出</span>
                                 </label>

                                 <div class="my-topbar-test-api-field my-topbar-test-api-stop-field">
                                     <label for="my-topbar-test-api-stop-string" class="my-topbar-test-label">停止字符</label>
                                     <input id="my-topbar-test-api-stop-string" class="text_pole my-topbar-test-api-input" type="text" spellcheck="false" autocomplete="off">
                                 </div>
                             </div>

                            <div class="my-topbar-test-api-drawer">
                                <button id="my-topbar-test-api-source-toggle"
                                        class="menu_button my-topbar-test-api-drawer-toggle"
                                        type="button">
                                    模型来源
                                </button>
                                 <div id="my-topbar-test-api-source-body" class="my-topbar-test-api-drawer-body" style="display: none;">
                                     <button id="my-topbar-test-api-source-current"
                                             class="menu_button my-topbar-test-api-source-current"
                                             type="button">
                                         与酒馆相同
                                     </button>
                                     <div id="my-topbar-test-api-source-options" class="my-topbar-test-api-source-options" style="display: none;"></div>

                                     <div id="my-topbar-test-api-custom-config" class="my-topbar-test-api-custom-config" style="display: none;">
                                         <div class="my-topbar-test-api-field">
                                             <label for="my-topbar-test-api-custom-base-url" class="my-topbar-test-label">API地址</label>
                                             <input id="my-topbar-test-api-custom-base-url" class="text_pole my-topbar-test-api-input" type="text" spellcheck="false" autocomplete="off">
                                         </div>

                                         <div class="my-topbar-test-api-field">
                                             <label for="my-topbar-test-api-custom-api-key" class="my-topbar-test-label">API密钥</label>
                                             <input id="my-topbar-test-api-custom-api-key" class="text_pole my-topbar-test-api-input" type="password" spellcheck="false" autocomplete="off">
                                         </div>

                                         <div class="my-topbar-test-api-field">
                                             <label for="my-topbar-test-api-custom-model-name" class="my-topbar-test-label">模型名称</label>
                                             <input id="my-topbar-test-api-custom-model-name" class="text_pole my-topbar-test-api-input" type="text" spellcheck="false" autocomplete="off">
                                         </div>

                                         <div class="my-topbar-test-api-field">
                                             <label class="my-topbar-test-label">获取模型</label>
                                             <button id="my-topbar-test-api-custom-fetch-models"
                                                     class="menu_button my-topbar-test-template-tool-button"
                                                     type="button">
                                                 获取模型
                                             </button>
                                             <select id="my-topbar-test-api-custom-model-select"
                                                     class="text_pole my-topbar-test-api-input my-topbar-test-api-model-select"
                                                     disabled>
                                                 <option value="">获取列表选择</option>
                                             </select>
                                         </div>
                                     </div>
                                 </div>
                             </div>
                           </div>

                      <div id="my-topbar-test-floating-settings" class="my-topbar-test-settings-section" style="display: none;">
                          <label for="my-topbar-test-floating-enabled" class="my-topbar-test-keep-tags-row">
                              <input id="my-topbar-test-floating-enabled"
                                     class="my-topbar-test-keep-tags-checkbox"
                                    type="checkbox">
                             <span class="my-topbar-test-keep-tags-text">开启悬浮窗</span>
                         </label>

                         <div class="my-topbar-test-template-tip">
                             长按然后拖拽可以移动悬浮窗位置。<br>
                             长按然后松开，可以触发长按触发的功能。
                         </div>

                         <div class="my-topbar-test-floating-field">
                             <div class="my-topbar-test-label">悬浮窗调整大小</div>

                             <div class="my-topbar-test-floating-size-grid">
                                 <label for="my-topbar-test-floating-size-length" class="my-topbar-test-floating-size-item">
                                     <span class="my-topbar-test-label">长度</span>
                                     <div class="my-topbar-test-floating-size-input-wrap">
                                         <input id="my-topbar-test-floating-size-length"
                                                class="my-topbar-test-floating-size-input"
                                                type="number"
                                                min="1"
                                                step="1"
                                                inputmode="numeric"
                                                placeholder="">
                                         <span class="my-topbar-test-floating-size-unit">px</span>
                                     </div>
                                 </label>

                                 <label for="my-topbar-test-floating-size-width" class="my-topbar-test-floating-size-item">
                                     <span class="my-topbar-test-label">宽度</span>
                                     <div class="my-topbar-test-floating-size-input-wrap">
                                         <input id="my-topbar-test-floating-size-width"
                                                class="my-topbar-test-floating-size-input"
                                                type="number"
                                                min="1"
                                                step="1"
                                                inputmode="numeric"
                                                placeholder="">
                                         <span class="my-topbar-test-floating-size-unit">px</span>
                                     </div>
                                 </label>
                             </div>
                         </div>

                         <div class="my-topbar-test-floating-field">
                             <label for="my-topbar-test-floating-click-action" class="my-topbar-test-label">点击触发的功能</label>
                             <select id="my-topbar-test-floating-click-action"
                                     class="text_pole my-topbar-test-floating-select"></select>
                         </div>

                         <div class="my-topbar-test-floating-field">
                             <label for="my-topbar-test-floating-long-press-action" class="my-topbar-test-label">长按触发的功能</label>
                             <select id="my-topbar-test-floating-long-press-action"
                                     class="text_pole my-topbar-test-floating-select"></select>
                         </div>

                         <div class="my-topbar-test-floating-field">
                             <label for="my-topbar-test-floating-double-click-action" class="my-topbar-test-label">双击触发的功能</label>
                             <select id="my-topbar-test-floating-double-click-action"
                                     class="text_pole my-topbar-test-floating-select"></select>
                         </div>
                     </div>

                     </div>

                     <div class="my-topbar-test-col-right">
                        <div class="my-topbar-test-section-title">截取与输出</div>
                        <label for="my-topbar-test-output" class="my-topbar-test-label" style="margin-bottom: 8px; display: block;">
                            这里会显示当前聊天窗口最底部最后一条消息；如果设置了范围，则只显示标签之间的内容（可编辑）
                        </label>

                        <textarea id="my-topbar-test-output"
                                  class="text_pole my-topbar-test-textarea"
                                  placeholder="点击“截取与发送”里的“手动触发”后，这里会自动填入内容。"
                                  spellcheck="false">琳喵喵很高兴为您服务</textarea>
                    </div>
                </div>

                <div id="my-topbar-test-reply-modal" class="my-topbar-test-reply-modal" style="display: none;">
                    <div class="my-topbar-test-reply-modal-card">
                        <button id="my-topbar-test-reply-modal-close"
                                class="menu_button my-topbar-test-reply-modal-close"
                                type="button"
                                aria-label="关闭回复确认框">
                            ×
                        </button>
                        <div id="my-topbar-test-reply-modal-title" class="my-topbar-test-reply-modal-title">AI 回复确认</div>

                        <div id="my-topbar-test-reply-modal-confirm-view" class="my-topbar-test-reply-modal-view">
                            <textarea id="my-topbar-test-reply-modal-text"
                                      class="text_pole my-topbar-test-reply-modal-textarea"
                                      spellcheck="false"
                                      placeholder="这里会显示 AI 的完整回复，可编辑后再确认替换。"></textarea>
                            <div class="my-topbar-test-reply-modal-actions">
                                <button id="my-topbar-test-reply-modal-feedback"
                                        class="menu_button my-topbar-test-template-tool-button"
                                        type="button">
                                    肘击
                                </button>
                                <button id="my-topbar-test-reply-modal-retry"
                                        class="menu_button my-topbar-test-template-tool-button"
                                        type="button">
                                    重来
                                </button>
                                <button id="my-topbar-test-reply-modal-confirm"
                                        class="menu_button my-topbar-test-template-tool-button"
                                        type="button">
                                    确认
                                </button>
                            </div>
                        </div>

                        <div id="my-topbar-test-reply-modal-feedback-view" class="my-topbar-test-reply-modal-view" style="display: none;">
                            <div class="my-topbar-test-reply-modal-tip">
                                可以输入对此次不满意的地方，提交之后根据您的反馈重新生成
                            </div>
                            <textarea id="my-topbar-test-reply-modal-feedback-input"
                                      class="text_pole my-topbar-test-reply-modal-feedback-textarea"
                                      spellcheck="false"
                                      placeholder="请输入这次不满意的地方"></textarea>
                            <div class="my-topbar-test-reply-modal-actions my-topbar-test-reply-modal-feedback-actions">
                                <button id="my-topbar-test-reply-modal-feedback-back"
                                        class="menu_button my-topbar-test-template-tool-button"
                                        type="button">
                                    返回
                                </button>
                                <button id="my-topbar-test-reply-modal-feedback-submit"
                                        class="menu_button my-topbar-test-template-tool-button"
                                        type="button">
                                    提交
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async function mountPanel() {
        if ($(SELECTORS.panel).length) {
            return;
        }

        try {
            const html = await $.get(`${EXTENSION_PATH}/settings.html`);
            $('body').append(html);
        } catch (error) {
            console.error(`[${MODULE_NAME}] 加载 settings.html 失败，使用备用面板。`, error);
            $('body').append(getPanelHtml());
        }
    }

    function mountButton() {
        const $topBar = $(SELECTORS.topBar);

        if (!$topBar.length) {
            console.error(`[${MODULE_NAME}] 找不到 #top-bar`);
            return;
        }

        $(SELECTORS.button).remove();

        const $button = $(`
            <div id="my-topbar-test-button"
                 style="display: flex;"
                 class="interactable"
                 title="琳喵喵后处理"
                 tabindex="0"
                 role="button"
                 aria-label="琳喵喵后处理">
                <span class="my-topbar-test-button-letter">H</span>
            </div>
        `);

        const $anchor = $(SELECTORS.anchor);
        if ($anchor.length) {
            $anchor.after($button);
        } else {
            $topBar.append($button);
        }
    }

    function bindEvents() {
        // 顶部按钮点击打开面板
        $(document)
            .off('click.myTopbarTest', SELECTORS.button)
            .on('click.myTopbarTest', SELECTORS.button, function (e) {
                e.preventDefault();
                e.stopPropagation();
                togglePanel();
            });

        $(document)
            .off('keydown.myTopbarTest', SELECTORS.button)
            .on('keydown.myTopbarTest', SELECTORS.button, function (e) {
                if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
                    e.preventDefault();
                    e.stopPropagation();
                    togglePanel();
                }
            });

        // 关闭按钮点击关闭面板
        $(document)
            .off('click.myTopbarTestClose', SELECTORS.closeBtn)
            .on('click.myTopbarTestClose', SELECTORS.closeBtn, function(e) {
                e.preventDefault();
                e.stopPropagation();
                hidePanel();
            });

        $(document)
            .off('click.myTopbarTestMobileTabMenu', SELECTORS.mobileTabMenu)
            .on('click.myTopbarTestMobileTabMenu', SELECTORS.mobileTabMenu, function (e) {
                e.preventDefault();
                e.stopPropagation();
                setMobilePanelView('menu');
            });

        $(document)
            .off('click.myTopbarTestMobileTabOutput', SELECTORS.mobileTabOutput)
            .on('click.myTopbarTestMobileTabOutput', SELECTORS.mobileTabOutput, function (e) {
                e.preventDefault();
                e.stopPropagation();
                setMobilePanelView('output');
            });

        $(document)
            .off('click.myTopbarTestMobileBack', SELECTORS.mobileBackButton)
            .on('click.myTopbarTestMobileBack', SELECTORS.mobileBackButton, function (e) {
                e.preventDefault();
                e.stopPropagation();
                setMobilePanelView('menu');
            });

        // 切换到 范围设置 标签
        $(document)
            .off('click.myTopbarTestRangeToggle', SELECTORS.rangeToggleButton)
            .on('click.myTopbarTestRangeToggle', SELECTORS.rangeToggleButton, function (e) {
                e.preventDefault();
                e.stopPropagation();
                switchTabToRange();
                if (isMobileLayout()) {
                    setMobilePanelView('detail');
                }
            });

        // 切换到 模板设置 标签
        $(document)
            .off('click.myTopbarTestTemplateToggle', SELECTORS.templateToggleButton)
            .on('click.myTopbarTestTemplateToggle', SELECTORS.templateToggleButton, function (e) {
                e.preventDefault();
                e.stopPropagation();
                switchTabToTemplate();
                if (isMobileLayout()) {
                    setMobilePanelView('detail');
                }
            });

        $(document)
            .off('click.myTopbarTestCaptureSendToggle', SELECTORS.captureSendToggleButton)
            .on('click.myTopbarTestCaptureSendToggle', SELECTORS.captureSendToggleButton, function (e) {
                e.preventDefault();
                e.stopPropagation();
                switchTabToCaptureSend();
                if (isMobileLayout()) {
                    setMobilePanelView('detail');
                }
            });

        $(document)
            .off('click.myTopbarTestApiToggle', SELECTORS.apiToggleButton)
            .on('click.myTopbarTestApiToggle', SELECTORS.apiToggleButton, function (e) {
                e.preventDefault();
                e.stopPropagation();
                switchTabToApiSettings();
                if (isMobileLayout()) {
                    setMobilePanelView('detail');
                }
            });

        $(document)
            .off('click.myTopbarTestFloatingToggle', SELECTORS.floatingToggleButton)
            .on('click.myTopbarTestFloatingToggle', SELECTORS.floatingToggleButton, function (e) {
                e.preventDefault();
                e.stopPropagation();
                switchTabToFloatingSettings();
                if (isMobileLayout()) {
                    setMobilePanelView('detail');
                }
            });

        $(document)
            .off('change.myTopbarTestAutoTriggerEnabled', SELECTORS.autoTriggerEnabledCheckbox)
            .on('change.myTopbarTestAutoTriggerEnabled', SELECTORS.autoTriggerEnabledCheckbox, function () {
                handleAutoTriggerEnabledCheckboxChanged();
            });

        $(document)
            .off('change.myTopbarTestSkipReplyConfirm', SELECTORS.skipReplyConfirmCheckbox)
            .on('change.myTopbarTestSkipReplyConfirm', SELECTORS.skipReplyConfirmCheckbox, function () {
                handleSkipReplyConfirmCheckboxChanged();
            });

        $(document)
            .off('change.myTopbarTestFloatingEnabled', SELECTORS.floatingEnabledCheckbox)
            .on('change.myTopbarTestFloatingEnabled', SELECTORS.floatingEnabledCheckbox, function () {
                handleFloatingWindowEnabledCheckboxChanged();
            });

        $(document)
            .off('change.myTopbarTestFloatingClickAction', SELECTORS.floatingClickActionSelect)
            .on('change.myTopbarTestFloatingClickAction', SELECTORS.floatingClickActionSelect, function () {
                handleFloatingWindowActionSelectChanged(SELECTORS.floatingClickActionSelect, 'clickAction');
            });

        $(document)
            .off('change.myTopbarTestFloatingLongPressAction', SELECTORS.floatingLongPressActionSelect)
            .on('change.myTopbarTestFloatingLongPressAction', SELECTORS.floatingLongPressActionSelect, function () {
                handleFloatingWindowActionSelectChanged(SELECTORS.floatingLongPressActionSelect, 'longPressAction');
            });

        $(document)
            .off('change.myTopbarTestFloatingDoubleClickAction', SELECTORS.floatingDoubleClickActionSelect)
            .on('change.myTopbarTestFloatingDoubleClickAction', SELECTORS.floatingDoubleClickActionSelect, function () {
                handleFloatingWindowActionSelectChanged(SELECTORS.floatingDoubleClickActionSelect, 'doubleClickAction');
            });

        $(document)
            .off('change.myTopbarTestFloatingSizeLength', SELECTORS.floatingSizeLengthInput)
            .on('change.myTopbarTestFloatingSizeLength', SELECTORS.floatingSizeLengthInput, function () {
                handleFloatingWindowSizeInputChanged(SELECTORS.floatingSizeLengthInput, 'length');
            });

        $(document)
            .off('change.myTopbarTestFloatingSizeWidth', SELECTORS.floatingSizeWidthInput)
            .on('change.myTopbarTestFloatingSizeWidth', SELECTORS.floatingSizeWidthInput, function () {
                handleFloatingWindowSizeInputChanged(SELECTORS.floatingSizeWidthInput, 'width');
            });

        $(document)
            .off('change.myTopbarTestKeepTags', SELECTORS.keepTagsCheckbox)
            .on('change.myTopbarTestKeepTags', SELECTORS.keepTagsCheckbox, function () {
                syncKeepTagsSettingFromCheckbox();
            });

        $(document)
            .off('change.myTopbarTestOnlyReplaceInTags', SELECTORS.onlyReplaceInTagsCheckbox)
            .on('change.myTopbarTestOnlyReplaceInTags', SELECTORS.onlyReplaceInTagsCheckbox, function () {
                const settings = loadSettings();
                settings.onlyReplaceInTags = $(SELECTORS.onlyReplaceInTagsCheckbox).is(':checked');
                savePluginSettings();
                syncOnlyReplaceInTagsUi();
            });

        $(document)
            .off('input.myTopbarTestStartTag', SELECTORS.startTagInput)
            .on('input.myTopbarTestStartTag', SELECTORS.startTagInput, function () {
                updateTagSettingFromInput(SELECTORS.startTagInput, 'startTag');
                syncStopStringWithEndTagIfNeeded();
            });

        $(document)
            .off('input.myTopbarTestEndTag', SELECTORS.endTagInput)
            .on('input.myTopbarTestEndTag', SELECTORS.endTagInput, function () {
                updateTagSettingFromInput(SELECTORS.endTagInput, 'endTag');
                syncStopStringWithEndTagIfNeeded();
            });

        $(document)
            .off('input.myTopbarTestApiTemperature', SELECTORS.apiTemperatureInput)
            .on('input.myTopbarTestApiTemperature', SELECTORS.apiTemperatureInput, function () {
                updateApiConfigString(SELECTORS.apiTemperatureInput, 'temperature');
            });

        $(document)
            .off('input.myTopbarTestApiTopP', SELECTORS.apiTopPInput)
            .on('input.myTopbarTestApiTopP', SELECTORS.apiTopPInput, function () {
                updateApiConfigString(SELECTORS.apiTopPInput, 'topP');
            });

        $(document)
            .off('input.myTopbarTestApiTopK', SELECTORS.apiTopKInput)
            .on('input.myTopbarTestApiTopK', SELECTORS.apiTopKInput, function () {
                updateApiConfigString(SELECTORS.apiTopKInput, 'topK');
            });

        $(document)
            .off('input.myTopbarTestApiPresencePenalty', SELECTORS.apiPresencePenaltyInput)
            .on('input.myTopbarTestApiPresencePenalty', SELECTORS.apiPresencePenaltyInput, function () {
                updateApiConfigString(SELECTORS.apiPresencePenaltyInput, 'presencePenalty');
            });

        $(document)
            .off('input.myTopbarTestApiFrequencyPenalty', SELECTORS.apiFrequencyPenaltyInput)
            .on('input.myTopbarTestApiFrequencyPenalty', SELECTORS.apiFrequencyPenaltyInput, function () {
                updateApiConfigString(SELECTORS.apiFrequencyPenaltyInput, 'frequencyPenalty');
            });

        $(document)
            .off('change.myTopbarTestApiStream', SELECTORS.apiStreamCheckbox)
            .on('change.myTopbarTestApiStream', SELECTORS.apiStreamCheckbox, function () {
                updateApiConfigBoolean(SELECTORS.apiStreamCheckbox, 'stream');
            });

        $(document)
            .off('input.myTopbarTestApiStopString', SELECTORS.apiStopStringInput)
            .on('input.myTopbarTestApiStopString', SELECTORS.apiStopStringInput, function () {
                const rawValue = String($(this).val() ?? '');
                const settings = loadSettings();
                const hasTags = Boolean(String(settings.startTag ?? '').trim() && String(settings.endTag ?? '').trim());
                const normalized = normalizeStopString(rawValue, hasTags, settings.endTag);
                if (rawValue !== normalized) {
                    $(this).val(normalized);
                }
                updateApiConfigField('stopString', normalized);
            });

        $(document)
            .off('input.myTopbarTestCustomApiBaseUrl', SELECTORS.apiCustomBaseUrlInput)
            .on('input.myTopbarTestCustomApiBaseUrl', SELECTORS.apiCustomBaseUrlInput, function () {
                const value = String($(this).val() ?? '');
                updateApiConfigField('customApiBaseUrl', value);

                const normalized = normalizeCustomApiBaseUrl(value);
                if (normalized !== customModelState.sourceBaseUrl) {
                    customModelState.sourceBaseUrl = '';
                    customModelState.models = [];
                    renderCustomModelSelect([]);
                }
            });

        $(document)
            .off('input.myTopbarTestCustomApiKey', SELECTORS.apiCustomApiKeyInput)
            .on('input.myTopbarTestCustomApiKey', SELECTORS.apiCustomApiKeyInput, function () {
                updateApiConfigField('customApiKey', String($(this).val() ?? ''));
            });

        $(document)
            .off('input.myTopbarTestCustomModelName', SELECTORS.apiCustomModelNameInput)
            .on('input.myTopbarTestCustomModelName', SELECTORS.apiCustomModelNameInput, function () {
                updateApiConfigField('customModelName', String($(this).val() ?? ''));
                syncCustomModelSelectUi();
            });

        $(document)
            .off('click.myTopbarTestCustomFetchModels', SELECTORS.apiCustomFetchModelsButton)
            .on('click.myTopbarTestCustomFetchModels', SELECTORS.apiCustomFetchModelsButton, async function (e) {
                e.preventDefault();
                e.stopPropagation();
                await fetchCustomModelsList();
            });

        $(document)
            .off('change.myTopbarTestCustomModelSelect', SELECTORS.apiCustomModelSelect)
            .on('change.myTopbarTestCustomModelSelect', SELECTORS.apiCustomModelSelect, function () {
                const selectedModel = String($(this).val() ?? '');
                $(SELECTORS.apiCustomModelNameInput).val(selectedModel);
                updateApiConfigField('customModelName', selectedModel);
            });

        $(document)
            .off('click.myTopbarTestApiSourceToggle', SELECTORS.apiModelSourceToggle)
            .on('click.myTopbarTestApiSourceToggle', SELECTORS.apiModelSourceToggle, function (e) {
                e.preventDefault();
                e.stopPropagation();
                toggleApiSourceDrawer();
            });

        $(document)
            .off('click.myTopbarTestApiSourceCurrent', SELECTORS.apiModelSourceCurrent)
            .on('click.myTopbarTestApiSourceCurrent', SELECTORS.apiModelSourceCurrent, function (e) {
                e.preventDefault();
                e.stopPropagation();
                toggleApiSourceOptions();
            });

        $(document)
            .off('click.myTopbarTestApiSourceOption', SELECTORS.apiModelSourceOptionButton)
            .on('click.myTopbarTestApiSourceOption', SELECTORS.apiModelSourceOptionButton, function (e) {
                e.preventDefault();
                e.stopPropagation();
                const value = String($(this).attr('data-source-value') ?? 'same');
                setApiModelSource(value);
            });

        $(document)
            .off('click.myTopbarTestTemplatePresetOutside')
            .on('click.myTopbarTestTemplatePresetOutside', function (e) {
                if (!templatePresetDrawerOpen) {
                    return;
                }

                if ($(e.target).closest('.my-topbar-test-template-preset-bar').length) {
                    return;
                }

                closeTemplatePresetDrawer();
            });

        $(document)
            .off('click.myTopbarTestTemplatePresetCurrent', SELECTORS.templatePresetCurrentButton)
            .on('click.myTopbarTestTemplatePresetCurrent', SELECTORS.templatePresetCurrentButton, function (e) {
                e.preventDefault();
                e.stopPropagation();
                toggleTemplatePresetDrawer();
            });

        $(document)
            .off('click.myTopbarTestTemplatePresetOption', SELECTORS.templatePresetOptionButton)
            .on('click.myTopbarTestTemplatePresetOption', SELECTORS.templatePresetOptionButton, async function (e) {
                e.preventDefault();
                e.stopPropagation();
                const presetId = String($(this).attr('data-preset-id') ?? '');
                await switchTemplatePreset(presetId);
            });

        $(document)
            .off('click.myTopbarTestTemplateDeletePreset', SELECTORS.templateDeletePresetButton)
            .on('click.myTopbarTestTemplateDeletePreset', SELECTORS.templateDeletePresetButton, async function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (consumeMobileLongPressClickSuppression()) {
                    return;
                }
                await deleteCurrentTemplatePreset();
            });

        $(document)
            .off('click.myTopbarTestTemplateAddPreset', SELECTORS.templateAddPresetButton)
            .on('click.myTopbarTestTemplateAddPreset', SELECTORS.templateAddPresetButton, async function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (consumeMobileLongPressClickSuppression()) {
                    return;
                }
                await addTemplatePreset();
            });

        $(document)
            .off('click.myTopbarTestTemplateRenamePreset', SELECTORS.templateRenamePresetButton)
            .on('click.myTopbarTestTemplateRenamePreset', SELECTORS.templateRenamePresetButton, async function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (consumeMobileLongPressClickSuppression()) {
                    return;
                }
                await renameCurrentTemplatePreset();
            });

        $(document)
            .off('click.myTopbarTestTemplateAdd', SELECTORS.templateAddButton)
            .on('click.myTopbarTestTemplateAdd', SELECTORS.templateAddButton, function (e) {
                e.preventDefault();
                e.stopPropagation();
                addTemplate();
            });

        $(document)
            .off('click.myTopbarTestTemplateExport', SELECTORS.templateExportButton)
            .on('click.myTopbarTestTemplateExport', SELECTORS.templateExportButton, async function (e) {
                e.preventDefault();
                e.stopPropagation();
                await exportTemplateData();
            });

        $(document)
            .off('click.myTopbarTestTemplateImport', SELECTORS.templateImportButton)
            .on('click.myTopbarTestTemplateImport', SELECTORS.templateImportButton, function (e) {
                e.preventDefault();
                e.stopPropagation();
                triggerTemplateImport();
            });

        $(document)
            .off('change.myTopbarTestTemplateImportInput', SELECTORS.templateImportInput)
            .on('change.myTopbarTestTemplateImportInput', SELECTORS.templateImportInput, async function () {
                const file = this.files && this.files[0] ? this.files[0] : null;
                await importTemplateFromFile(file);
            });

        $(document)
            .off('click.myTopbarTestTemplateEdit', SELECTORS.templateEditButton)
            .on('click.myTopbarTestTemplateEdit', SELECTORS.templateEditButton, async function (e) {
                e.preventDefault();
                e.stopPropagation();

                const templateId = String($(this).attr('data-template-id') ?? '');
                await openTemplateEditor(templateId);
            });

        $(document)
            .off('click.myTopbarTestTemplateDelete', SELECTORS.templateDeleteButton)
            .on('click.myTopbarTestTemplateDelete', SELECTORS.templateDeleteButton, async function (e) {
                e.preventDefault();
                e.stopPropagation();

                const templateId = String($(this).attr('data-template-id') ?? '');
                await openTemplateDeleteView(templateId);
            });

        $(document)
            .off('change.myTopbarTestTemplateDeleteSkip', SELECTORS.templateEditorDeleteSkipCheckbox)
            .on('change.myTopbarTestTemplateDeleteSkip', SELECTORS.templateEditorDeleteSkipCheckbox, function () {
                if (!isTemplateDeleteMode()) {
                    return;
                }

                templateEditorState.skipFutureDeleteConfirm = $(this).is(':checked');
            });

        $(document)
            .off('click.myTopbarTestTemplateEditorSave', SELECTORS.templateEditorSaveButton)
            .on('click.myTopbarTestTemplateEditorSave', SELECTORS.templateEditorSaveButton, async function (e) {
                e.preventDefault();
                e.stopPropagation();
                await handleTemplateEditorSave();
            });

        $(document)
            .off('click.myTopbarTestTemplateEditorExit', SELECTORS.templateEditorExitButton)
            .on('click.myTopbarTestTemplateEditorExit', SELECTORS.templateEditorExitButton, async function (e) {
                e.preventDefault();
                e.stopPropagation();
                await handleTemplateEditorExit();
            });

        $(document)
            .off('pointerdown.myTopbarTestTemplateDrag', SELECTORS.templateApplyButton)
            .on('pointerdown.myTopbarTestTemplateDrag', SELECTORS.templateApplyButton, function (e) {
                const originalEvent = e.originalEvent || e;
                if (originalEvent.pointerType === 'mouse' && originalEvent.button !== 0) {
                    return;
                }

                const templateId = String($(this).attr('data-template-id') ?? '');
                beginTemplateSortPress(templateId, originalEvent.pointerId, originalEvent.clientX, originalEvent.clientY, this);
            });

        $(document)
            .off('pointerdown.myTopbarTestTemplateLongPressTip', '.my-topbar-test-template-icon-button[data-long-press-tip]')
            .on('pointerdown.myTopbarTestTemplateLongPressTip', '.my-topbar-test-template-icon-button[data-long-press-tip]', function (e) {
                if (!isMobileLayout()) {
                    return;
                }

                const originalEvent = e.originalEvent || e;
                if (originalEvent.pointerType === 'mouse' && originalEvent.button !== 0) {
                    return;
                }

                const tip = String($(this).attr('data-long-press-tip') ?? '').trim();
                if (!tip) {
                    return;
                }

                beginMobileLongPressTip(originalEvent.pointerId, originalEvent.clientX, originalEvent.clientY, this, tip);
            });

        $(document)
            .off('pointermove.myTopbarTestTemplateInteractions')
            .on('pointermove.myTopbarTestTemplateInteractions', function (e) {
                const originalEvent = e.originalEvent || e;

                if (templateSortState.pointerId !== null && originalEvent.pointerId === templateSortState.pointerId) {
                    const movedX = Math.abs(originalEvent.clientX - templateSortState.startX);
                    const movedY = Math.abs(originalEvent.clientY - templateSortState.startY);
                    if (!templateSortState.isDragging && (movedX > 8 || movedY > 8)) {
                        resetTemplateSortState();
                    } else if (templateSortState.isDragging) {
                        e.preventDefault();
                        updateDraggedTemplatePosition(originalEvent.clientX, originalEvent.clientY);
                        maybeMoveDraggedTemplate(originalEvent.clientX, originalEvent.clientY);
                    }
                }

                if (mobileLongPressState.pointerId !== null && originalEvent.pointerId === mobileLongPressState.pointerId) {
                    const movedX = Math.abs(originalEvent.clientX - mobileLongPressState.startX);
                    const movedY = Math.abs(originalEvent.clientY - mobileLongPressState.startY);
                    if (movedX > 8 || movedY > 8) {
                        resetMobileLongPressState();
                    }
                }
            });

        $(document)
            .off('pointerup.myTopbarTestTemplateInteractions pointercancel.myTopbarTestTemplateInteractions')
            .on('pointerup.myTopbarTestTemplateInteractions pointercancel.myTopbarTestTemplateInteractions', function (e) {
                const originalEvent = e.originalEvent || e;

                if (templateSortState.pointerId !== null && originalEvent.pointerId === templateSortState.pointerId) {
                    finalizeTemplateSort();
                }

                if (mobileLongPressState.pointerId !== null && originalEvent.pointerId === mobileLongPressState.pointerId) {
                    resetMobileLongPressState();
                }
            });

        $(document)
            .off('click.myTopbarTestTemplateApply', SELECTORS.templateApplyButton)
            .on('click.myTopbarTestTemplateApply', SELECTORS.templateApplyButton, function (e) {
                if (consumeTemplateSortClickSuppression()) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                const templateId = String($(this).attr('data-template-id') ?? '');
                toggleTemplateSelection(templateId);
            });

        $(document)
            .off('click.myTopbarTestManualTrigger', SELECTORS.manualTriggerButton)
            .on('click.myTopbarTestManualTrigger', SELECTORS.manualTriggerButton, async function (e) {
                e.preventDefault();
                e.stopPropagation();
                await handleManualTrigger();
            });

        $(document)
            .off('click.myTopbarTestManualSend', SELECTORS.manualSendButton)
            .on('click.myTopbarTestManualSend', SELECTORS.manualSendButton, async function (e) {
                e.preventDefault();
                e.stopPropagation();
                await handleManualSend();
            });

        $(document)
            .off('click.myTopbarTestStopManualFlow', SELECTORS.stopManualFlowButton)
            .on('click.myTopbarTestStopManualFlow', SELECTORS.stopManualFlowButton, function (e) {
                e.preventDefault();
                e.stopPropagation();
                stopFlow();
            });

        $(document)
            .off('pointerdown.myTopbarTestFloatingWindow', SELECTORS.floatingWindow)
            .on('pointerdown.myTopbarTestFloatingWindow', SELECTORS.floatingWindow, function (e) {
                const originalEvent = e.originalEvent || e;
                if (originalEvent.pointerType === 'mouse' && originalEvent.button !== 0) {
                    return;
                }

                e.preventDefault();
                e.stopPropagation();
                beginFloatingWindowPress(originalEvent.pointerId, originalEvent.clientX, originalEvent.clientY, this);
            });

        $(document)
            .off('pointermove.myTopbarTestFloatingWindow')
            .on('pointermove.myTopbarTestFloatingWindow', function (e) {
                const originalEvent = e.originalEvent || e;
                const wasDragging = floatingWindowState.isDragging;

                handleFloatingWindowPointerMove(originalEvent.pointerId, originalEvent.clientX, originalEvent.clientY);

                if (wasDragging || floatingWindowState.isDragging) {
                    e.preventDefault();
                }
            });

        $(document)
            .off('pointerup.myTopbarTestFloatingWindow pointercancel.myTopbarTestFloatingWindow')
            .on('pointerup.myTopbarTestFloatingWindow pointercancel.myTopbarTestFloatingWindow', function (e) {
                const originalEvent = e.originalEvent || e;
                finalizeFloatingWindowPress(originalEvent.pointerId, originalEvent.pointerType);
            });

        $(document)
            .off('keydown.myTopbarTestFloatingWindow', SELECTORS.floatingWindow)
            .on('keydown.myTopbarTestFloatingWindow', SELECTORS.floatingWindow, function (e) {
                if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
                    e.preventDefault();
                    e.stopPropagation();
                    clearFloatingWindowSingleClickTimer();
                    floatingWindowState.lastTapTime = 0;
                    floatingWindowState.lastTapPointerType = '';
                    void triggerFloatingWindowAction('clickAction');
                }
            });

        $(document)
            .off('click.myTopbarTestReplyModalConfirm', SELECTORS.replyModalConfirmButton)
            .on('click.myTopbarTestReplyModalConfirm', SELECTORS.replyModalConfirmButton, async function (e) {
                e.preventDefault();
                e.stopPropagation();
                await confirmReplaceLastMessage();
            });

        $(document)
            .off('click.myTopbarTestReplyModalRetry', SELECTORS.replyModalRetryButton)
            .on('click.myTopbarTestReplyModalRetry', SELECTORS.replyModalRetryButton, async function (e) {
                e.preventDefault();
                e.stopPropagation();
                await handleReplyModalRetry();
            });

        $(document)
            .off('click.myTopbarTestReplyModalFeedback', SELECTORS.replyModalFeedbackButton)
            .on('click.myTopbarTestReplyModalFeedback', SELECTORS.replyModalFeedbackButton, function (e) {
                e.preventDefault();
                e.stopPropagation();
                openReplyModalFeedbackView();
            });

        $(document)
            .off('click.myTopbarTestReplyModalFeedbackBack', SELECTORS.replyModalFeedbackBackButton)
            .on('click.myTopbarTestReplyModalFeedbackBack', SELECTORS.replyModalFeedbackBackButton, function (e) {
                e.preventDefault();
                e.stopPropagation();
                openReplyModalConfirmView();
            });

        $(document)
            .off('click.myTopbarTestReplyModalFeedbackSubmit', SELECTORS.replyModalFeedbackSubmitButton)
            .on('click.myTopbarTestReplyModalFeedbackSubmit', SELECTORS.replyModalFeedbackSubmitButton, async function (e) {
                e.preventDefault();
                e.stopPropagation();
                await handleReplyModalFeedbackSubmit();
            });

        $(document)
            .off('click.myTopbarTestReplyModalClose', SELECTORS.replyModalCloseButton)
            .on('click.myTopbarTestReplyModalClose', SELECTORS.replyModalCloseButton, function (e) {
                e.preventDefault();
                e.stopPropagation();
                hideReplyModal();
            });

        $(window)
            .off('resize.myTopbarTestLayout')
            .on('resize.myTopbarTestLayout', function () {
                syncMobileTabsUi();
                syncReplyModalViewportMetrics();
                syncFloatingWindowSettingsUi();
                syncFloatingWindowUi();
            });
    }

    async function init() {
        loadSettings();
        await mountPanel();
        mountFloatingWindow();
        syncAutoTriggerStateFromCurrentChat();
        syncUiFromSettings();
        syncMobileTabsUi();
        setExtractedBaseText(DEFAULT_TEXT);
        syncOutputFromSelectedTemplates();
        ensureReplyModalMountedAtInit();
        mountButton();
        bindEvents();
        eventSource.off?.(event_types.CHAT_CHANGED, handleChatChanged);
        eventSource.on(event_types.CHAT_CHANGED, handleChatChanged);

        eventSource.off?.(event_types.GENERATION_STOPPED, handleGenerationStopped);
        eventSource.on(event_types.GENERATION_STOPPED, handleGenerationStopped);
        eventSource.off?.(event_types.GENERATION_ENDED, handleGenerationEnded);
        eventSource.on(event_types.GENERATION_ENDED, handleGenerationEnded);

        if (!initialized) {
            initialized = true;
            log('插件已加载完成');
        }
    }

    eventSource.on(event_types.APP_READY, init);
})();
