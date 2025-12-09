package com.backend.service;

import com.backend.dto.*;
import com.backend.entity.*;
import com.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class IssueService {

    private final IssueHeaderRepository issueHeaderRepo;
    private final IssueDetailRepository issueDetailRepo;
    private final IssueReqHeaderRepository issueReqHeaderRepo;
    private final InventoryCardRepository inventoryCardRepo;
    private final MaterialRepository materialRepo;
    private final DepartmentRepository departmentRepo;
    private final UserRepository userRepo;

    // ==================== TẠO PHIẾU XUẤT KHO ====================
    public Map<String, Object> createIssueFromRequest(IssueRequestDTO request, Long thuKhoId) {
        try {
            User thuKho = validateThuKho(thuKhoId);

            // Lấy phiếu xin lĩnh đã duyệt
            IssueReqHeader issueReq = issueReqHeaderRepo.findById(request.getIssueReqId())
                    .orElseThrow(() -> new RuntimeException("Phiếu xin lĩnh không tồn tại"));

            if (!issueReq.isApproved()) {
                throw new RuntimeException("Chỉ xuất kho từ phiếu đã được phê duyệt");
            }

            // Kiểm tra đã xuất chưa
            boolean alreadyIssued = issueHeaderRepo.findByIssueReqId(issueReq.getId()).size() > 0;
            if (alreadyIssued) {
                throw new RuntimeException("Phiếu này đã được xuất kho");
            }

            // Tạo phiếu xuất
            IssueHeader header = new IssueHeader();
            header.setCreatedBy(thuKho);
            header.setReceiverName(request.getReceiverName());
            header.setIssueDate(request.getIssueDate() != null ? request.getIssueDate() : LocalDate.now());
            header.setIssueReq(issueReq);
            header.setTotalAmount(BigDecimal.ZERO);

            if (request.getDepartmentId() != null) {
                Department dept = departmentRepo.findById(request.getDepartmentId())
                        .orElseThrow(() -> new RuntimeException("Khoa/phòng không tồn tại"));
                header.setDepartment(dept);
            } else if (issueReq.getDepartment() != null) {
                header.setDepartment(issueReq.getDepartment());
            }

            header = issueHeaderRepo.save(header);

            // Tạo chi tiết xuất và kiểm tra tồn kho
            BigDecimal totalAmount = BigDecimal.ZERO;
            List<IssueDetail> details = new ArrayList<>();

            for (IssueDetailRequestDTO detailDTO : request.getDetails()) {
                IssueDetail detail = createIssueDetail(header, detailDTO, issueReq);
                details.add(detail);
                totalAmount = totalAmount.add(detail.getTotal());

                // Trừ tồn kho
                consumeStock(detailDTO.getInventoryCardId(), detailDTO.getQtyIssued());
            }

            header.setDetails(details);
            header.setTotalAmount(totalAmount);
            issueHeaderRepo.save(header);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Xuất kho thành công");
            result.put("issueId", header.getId());
            result.put("totalAmount", totalAmount);
            return result;

        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("message", "Lỗi khi xuất kho: " + e.getMessage());
            return result;
        }
    }

    // ==================== LẤY PHIẾU XIN LĨNH ĐÃ DUYỆT ====================
    @Transactional(readOnly = true)
    public Map<String, Object> getApprovedRequests(Long thuKhoId) {
        try {
            User thuKho = validateThuKho(thuKhoId);

            // Lấy phiếu xin lĩnh đã duyệt (status = 1)
            List<IssueReqHeader> approvedRequests = issueReqHeaderRepo.findByStatus(1);

            // Filter những phiếu chưa được xuất
            List<Map<String, Object>> requestDTOs = new ArrayList<>();
            for (IssueReqHeader req : approvedRequests) {
                boolean alreadyIssued = issueHeaderRepo.findByIssueReqId(req.getId()).size() > 0;
                if (!alreadyIssued) {
                    Map<String, Object> reqMap = new HashMap<>();
                    reqMap.put("id", req.getId());
                    reqMap.put("requestedAt", req.getRequestedAt());
                    reqMap.put("createdById", req.getCreatedBy().getId());
                    reqMap.put("createdByName", req.getCreatedBy().getFullName());
                    reqMap.put("departmentId", req.getDepartment() != null ? req.getDepartment().getId() : null);
                    reqMap.put("departmentName", req.getDepartment() != null ? req.getDepartment().getName() : "");
                    reqMap.put("subDepartmentName", req.getSubDepartment() != null ? req.getSubDepartment().getName() : "");
                    reqMap.put("note", req.getNote());
                    reqMap.put("detailCount", req.getDetails() != null ? req.getDetails().size() : 0);

                    // Details
                    List<Map<String, Object>> detailList = new ArrayList<>();
                    if (req.getDetails() != null) {
                        for (IssueReqDetail d : req.getDetails()) {
                            Map<String, Object> detailMap = new HashMap<>();
                            detailMap.put("materialId", d.getMaterial() != null ? d.getMaterial().getId() : null);
                            detailMap.put("materialName", d.getDisplayMaterialName());
                            detailMap.put("spec", d.getDisplaySpec());
                            detailMap.put("unitName", d.getDisplayUnit());
                            detailMap.put("qtyRequested", d.getQtyRequested());
                            detailList.add(detailMap);
                        }
                    }
                    reqMap.put("details", detailList);

                    requestDTOs.add(reqMap);
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Lấy danh sách phiếu đã duyệt thành công");
            result.put("data", requestDTOs);
            return result;

        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("message", "Lỗi khi lấy danh sách phiếu đã duyệt: " + e.getMessage());
            result.put("data", Collections.emptyList());
            return result;
        }
    }

    // ==================== LẤY DANH SÁCH PHIẾU XUẤT ====================
    @Transactional(readOnly = true)
    public Map<String, Object> getMyIssues(Long thuKhoId) {
        try {
            User thuKho = userRepo.findById(thuKhoId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            if (!thuKho.isThuKho()) {
                throw new RuntimeException("Chỉ thủ kho được xem phiếu xuất");
            }

            List<IssueHeader> issues = issueHeaderRepo.findByCreatedByIdOrderByIssueDateDesc(thuKhoId);

            List<Map<String, Object>> issueDTOs = issues.stream()
                    .map(issue -> {
                        Map<String, Object> map = new HashMap<>();
                        map.put("id", issue.getId());
                        map.put("receiverName", issue.getReceiverName());
                        map.put("issueDate", issue.getIssueDate());
                        map.put("totalAmount", issue.getTotalAmount());
                        map.put("departmentName", issue.getDepartment() != null ? issue.getDepartment().getName() : "");
                        map.put("issueReqId", issue.getIssueReq() != null ? issue.getIssueReq().getId() : null);
                        map.put("itemCount", issue.getDetails() != null ? issue.getDetails().size() : 0);
                        return map;
                    })
                    .collect(Collectors.toList());

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Lấy danh sách phiếu xuất thành công");
            result.put("data", issueDTOs);
            return result;

        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("message", "Lỗi khi lấy danh sách phiếu xuất: " + e.getMessage());
            result.put("data", Collections.emptyList());
            return result;
        }
    }

    // ==================== PRIVATE HELPER METHODS ====================

    private IssueDetail createIssueDetail(IssueHeader header, IssueDetailRequestDTO dto, IssueReqHeader issueReq) {
        Material material = materialRepo.findById(dto.getMaterialId())
                .orElseThrow(() -> new RuntimeException("Vật tư không tồn tại"));

        InventoryCard inventoryCard = inventoryCardRepo.findById(dto.getInventoryCardId())
                .orElseThrow(() -> new RuntimeException("Lô kho không tồn tại"));

        // Kiểm tra tồn kho
        if (!inventoryCard.hasStock(dto.getQtyIssued())) {
            throw new RuntimeException("Lô " + inventoryCard.getLotNumber() +
                    " chỉ còn " + inventoryCard.getClosingStock() + " " +
                    material.getUnit().getName());
        }

        // Tìm chi tiết trong phiếu xin lĩnh để lấy số lượng yêu cầu
        BigDecimal qtyRequested = findRequestedQty(issueReq, material.getId());

        IssueDetail detail = new IssueDetail();
        detail.setHeader(header);
        detail.setMaterial(material);
        detail.setInventoryCard(inventoryCard);
        detail.setName(material.getName());
        detail.setSpec(material.getSpec());
        detail.setCode(material.getCode());
        detail.setUnit(material.getUnit());
        detail.setUnitPrice(getUnitPrice(material.getId())); // Lấy giá từ lần nhập gần nhất
        detail.setQtyRequested(qtyRequested);
        detail.setQtyIssued(dto.getQtyIssued());

        return issueDetailRepo.save(detail);
    }

    private BigDecimal findRequestedQty(IssueReqHeader issueReq, Long materialId) {
        return issueReq.getDetails().stream()
                .filter(d -> d.getMaterial() != null && d.getMaterial().getId().equals(materialId))
                .map(IssueReqDetail::getQtyRequested)
                .findFirst()
                .orElse(BigDecimal.ZERO);
    }

    private BigDecimal getUnitPrice(Long materialId) {
        // TODO: Implement logic lấy giá từ lần nhập gần nhất
        // Tạm thời: lấy giá từ receipt_detail gần nhất
        return BigDecimal.valueOf(100000); // Tạm thời
    }

    private void consumeStock(Long inventoryCardId, BigDecimal qty) {
        InventoryCard card = inventoryCardRepo.findById(inventoryCardId)
                .orElseThrow(() -> new RuntimeException("Lô kho không tồn tại"));

        card.consumeStock(qty);
        inventoryCardRepo.save(card);
    }

    private User validateThuKho(Long userId) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        if (!user.isThuKho()) {
            throw new RuntimeException("Chỉ thủ kho được xuất kho");
        }

        if (!user.isApproved()) {
            throw new RuntimeException("Tài khoản chưa được kích hoạt");
        }

        return user;
    }
}