package com.backend.service.impl;

import com.backend.dto.DepartmentDTO;
import com.backend.entity.DepartmentEntity;
import com.backend.repository.DepartmentRepository;
import com.backend.service.DepartmentService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class DepartmentServiceImpl implements DepartmentService {

    @Autowired
    private DepartmentRepository departmentRepository;

    private DepartmentDTO toDTO(DepartmentEntity entity) {
        DepartmentDTO dto = new DepartmentDTO();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }

    private DepartmentEntity toEntity(DepartmentDTO dto) {
        DepartmentEntity entity = new DepartmentEntity();
        entity.setId(dto.getId());
        entity.setName(dto.getName());
        return entity;
    }

    @Override
    public List<DepartmentDTO> getAllDepartments() {
        return departmentRepository.findAll()
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public DepartmentDTO getDepartmentById(Long id) {
        DepartmentEntity entity = departmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Department not found"));
        return toDTO(entity);
    }

    @Override
    public DepartmentDTO createDepartment(DepartmentDTO dto) {
        DepartmentEntity entity = toEntity(dto);
        DepartmentEntity saved = departmentRepository.save(entity);
        return toDTO(saved);
    }

    @Override
    public DepartmentDTO updateDepartment(Long id, DepartmentDTO dto) {
        DepartmentEntity entity = departmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Department not found"));

        entity.setName(dto.getName());

        DepartmentEntity updated = departmentRepository.save(entity);
        return toDTO(updated);
    }

    @Override
    public void deleteDepartment(Long id) {
        if (!departmentRepository.existsById(id)) {
            throw new RuntimeException("Department not found");
        }
        departmentRepository.deleteById(id);
    }
}
