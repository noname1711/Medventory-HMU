package com.backend.service;

import com.backend.entity.SystemSetting;
import com.backend.repository.SystemSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class SystemSettingsService {

    private static final String ISSUE_REQ_AUTO_APPROVE_KEY = "issue_req.auto_approve_enabled";

    private final SystemSettingRepository systemSettingRepository;

    @Value("${medventory.issue-req.auto-approve-enabled:false}")
    private boolean defaultIssueReqAutoApproveEnabled;

    @Transactional(readOnly = true)
    public boolean isIssueReqAutoApproveEnabled() {
        return systemSettingRepository.findById(ISSUE_REQ_AUTO_APPROVE_KEY)
                .map(setting -> Boolean.parseBoolean(setting.getValue()))
                .orElse(defaultIssueReqAutoApproveEnabled);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getIssueReqAutoApproveSetting() {
        return Map.of(
                "key", ISSUE_REQ_AUTO_APPROVE_KEY,
                "enabled", isIssueReqAutoApproveEnabled(),
                "defaultEnabled", defaultIssueReqAutoApproveEnabled
        );
    }

    @Transactional
    public Map<String, Object> updateIssueReqAutoApproveSetting(boolean enabled) {
        SystemSetting setting = systemSettingRepository.findById(ISSUE_REQ_AUTO_APPROVE_KEY)
                .orElseGet(() -> {
                    SystemSetting created = new SystemSetting();
                    created.setKey(ISSUE_REQ_AUTO_APPROVE_KEY);
                    return created;
                });

        setting.setValue(Boolean.toString(enabled));
        systemSettingRepository.save(setting);

        return getIssueReqAutoApproveSetting();
    }
}
