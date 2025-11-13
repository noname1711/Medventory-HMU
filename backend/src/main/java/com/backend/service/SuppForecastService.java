package com.backend.service;
import  com.backend.repository.SuppForecastDetailRepository;
import com.backend.dto.SuppForecastDetailDTO;
import com.backend.dto.SuppForecastRequestDTO;
import com.backend.dto.SuppForecastPreviousDTO;
import com.backend.entity.Material;
import com.backend.entity.SuppForecastDetail;
import com.backend.entity.SuppForecastHeader;
import com.backend.entity.User;
import com.backend.repository.MaterialRepository;
import com.backend.repository.SuppForecastHeaderRepository;
import com.backend.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.List;

@Service
public class SuppForecastService {

    @Autowired
    private SuppForecastHeaderRepository headerRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MaterialRepository materialRepository;

    @Autowired
    private SuppForecastDetailRepository detailRepository;

    @Transactional
    public SuppForecastHeader createForecast(SuppForecastRequestDTO dto) {
        SuppForecastHeader header = new SuppForecastHeader();
        header.setAcademicYear(dto.getAcademicYear());
        header.setDepartmentId(dto.getDepartmentId());
        header.setStatus("pending");

        if (dto.getCreatedByEmail() != null && !dto.getCreatedByEmail().isBlank()) {
            Optional<User> uOpt = userRepository.findByEmail(dto.getCreatedByEmail());
            uOpt.ifPresent(header::setCreatedBy);
        }

        if (dto.getItems() != null) {
            for (SuppForecastDetailDTO itemDto : dto.getItems()) {
                SuppForecastDetail detail = new SuppForecastDetail();
                detail.setHeader(header);

                if (itemDto.getMaterialId() != null) {
                    Optional<Material> mOpt = materialRepository.findById(itemDto.getMaterialId());
                    mOpt.ifPresent(detail::setMaterial);
                }

                if (itemDto.getCurrentStock() != null) detail.setCurrentStock(itemDto.getCurrentStock());
                if (itemDto.getPrevYearQty() != null) detail.setPrevYearQty(itemDto.getPrevYearQty());
                detail.setThisYearQty(itemDto.getThisYearQty());
                detail.setProposedCode(itemDto.getProposedCode());
                detail.setProposedManufacturer(itemDto.getProposedManufacturer());
                detail.setJustification(itemDto.getJustification());

                header.getDetails().add(detail);
            }
        }

        return headerRepository.save(header);
    }

    public List<SuppForecastPreviousDTO> loadPreviousForecast(Integer departmentId) {

        String previousYear = "2025-2026"; // TODO: bạn có thể tự động tính theo năm hiện tại

        List<SuppForecastHeader> headers;

        if (departmentId != null) {
            headers = headerRepository.findByAcademicYearAndDepartmentId(previousYear, departmentId);
        } else {
            headers = headerRepository.findByAcademicYear(previousYear);
        }

        List<SuppForecastPreviousDTO> result = new java.util.ArrayList<>();

        for (SuppForecastHeader h : headers) {
            for (SuppForecastDetail d : h.getDetails()) {

                SuppForecastPreviousDTO dto = new SuppForecastPreviousDTO();
                dto.setMaterialId(d.getMaterial() != null ? d.getMaterial().getId() : null);
                dto.setMaterialName(d.getMaterial() != null ? d.getMaterial().getName() : null);
                dto.setSpecification(d.getMaterial() != null ? d.getMaterial().getSpec() : null);
                dto.setUnitId(d.getMaterial() != null ? d.getMaterial().getUnitId() : null);
                dto.setMaterialCode(d.getMaterial() != null ? d.getMaterial().getCode() : null);
                dto.setManufacturer(d.getMaterial() != null ? d.getMaterial().getManufacturer() : null);

                dto.setCurrentStock(d.getCurrentStock());
                dto.setPrevYearQty(d.getPrevYearQty());
                dto.setThisYearQty(d.getThisYearQty());

                dto.setJustification("Tự động tạo dự trù"); // AUTO FILL
                dto.setProposedCode(d.getProposedCode());
                dto.setProposedManufacturer(d.getProposedManufacturer());
                dto.setAcademicYear(h.getAcademicYear());

                result.add(dto);
            }
        }

        return result;
    }
}
