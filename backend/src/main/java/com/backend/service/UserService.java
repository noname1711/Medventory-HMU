package com.backend.service;

import com.backend.dto.RegisterRequest;
import com.backend.dto.UserDTO;
import com.backend.entity.User;
import com.backend.entity.Department;
import com.backend.repository.UserRepository;
import com.backend.repository.DepartmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    // Map role từ tiếng Việt sang roleCheck
    private Integer mapRoleToRoleCheck(String role) {
        switch (role) {
            case "Lãnh đạo": return 1;
            case "Thủ kho": return 2;
            case "Cán bộ": return 3;
            default: return 3; // Mặc định là Cán bộ
        }
    }

    public User registerUser(RegisterRequest request) {
        try {
            // CHỈ CHO PHÉP ĐĂNG KÝ VỚI KHOA ĐÃ CÓ TRONG DB
            Department department = departmentRepository.findByName(request.getDepartment())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy khoa: " + request.getDepartment() + ". Vui lòng chọn khoa có sẵn trong hệ thống."));

            User user = new User();
            user.setFullName(request.getFullName());
            user.setEmail(request.getEmail());
            user.setPassword(request.getPassword());
            user.setDateOfBirth(request.getDateOfBirth());
            user.setDepartment(department);

            // Xử lý role theo database schema mới
            String roleStr = request.getRole();
            Integer roleCheck = mapRoleToRoleCheck(roleStr);
            user.setRoleCheck(roleCheck);
            user.setRole(roleStr); // Lưu tên role thực tế

            user.setStatus(0); // 0 = pending

            return userRepository.save(user);
        } catch (Exception e) {
            throw new RuntimeException("Lỗi đăng ký: " + e.getMessage(), e);
        }
    }

    public User authenticateUser(String email, String password) {
        Optional<User> userOpt = userRepository.findByEmailAndPassword(email, password);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            // Cho phép đăng nhập nếu:
            // - Là Ban Giám Hiệu (roleCheck = 0) - LUÔN được đăng nhập
            // - Hoặc là user thường VÀ đã được approved (status = 1)
            if (user.isBanGiamHieu() || user.getStatus() == 1) {
                return user;
            }
        }
        return null;
    }

    public List<UserDTO> getPendingUsers() {
        return userRepository.findByStatus(0) // 0 = pending
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public List<UserDTO> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public boolean updateUserStatus(Long userId, String status) {
        return userRepository.findById(userId)
                .map(user -> {
                    // Chuyển đổi status từ string sang integer
                    int statusValue = "approved".equals(status) ? 1 : 0;
                    user.setStatus(statusValue);
                    userRepository.save(user);
                    return true;
                })
                .orElse(false);
    }

    public UserDTO convertToDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setFullName(user.getFullName());
        dto.setEmail(user.getEmail());
        dto.setDateOfBirth(user.getDateOfBirth());
        dto.setDepartment(user.getDepartment() != null ? user.getDepartment().getName() : null);

        // Sử dụng helper methods từ User entity
        dto.setRole(user.getRoleName());

        // QUAN TRỌNG: Nếu là Ban Giám Hiệu, sử dụng role thực tế từ database
        if (user.isBanGiamHieu() && user.getRole() != null && !user.getRole().isEmpty()) {
            dto.setRole(user.getRole()); // Hiển thị "Hiệu trưởng", "Phó Hiệu trưởng"
        } else {
            dto.setRole(user.getRoleName()); // Hiển thị "Ban Giám Hiệu", "Lãnh đạo", etc.
        }

        dto.setStatus(user.getStatusName());
        dto.setRoleCheck(user.getRoleCheck());
        dto.setStatusValue(user.getStatus());
        dto.setIsApproved(user.isApproved());
        dto.setIsBanGiamHieu(user.isBanGiamHieu());
        dto.setIsLanhDao(user.isLanhDao());
        dto.setIsThuKho(user.isThuKho());
        dto.setIsCanBo(user.isCanBo());

        return dto;
    }

    public boolean emailExists(String email) {
        return userRepository.existsByEmail(email);
    }

    public boolean deleteUser(Long userId) {
        if (!userRepository.existsById(userId)) {
            return false;
        }
        userRepository.deleteById(userId);
        return true;
    }

    public boolean updateUserRole(Long userId, String newRole) {
        return userRepository.findById(userId)
                .map(user -> {
                    Integer roleCheck = mapRoleToRoleCheck(newRole);
                    user.setRoleCheck(roleCheck);
                    user.setRole(newRole);
                    userRepository.save(user);
                    return true;
                })
                .orElse(false);
    }

    public boolean updatePassword(String email, String newPassword) {
        return userRepository.findByEmail(email)
                .map(user -> {
                    user.setPassword(newPassword);
                    userRepository.save(user);
                    return true;
                })
                .orElse(false);
    }

    public List<Department> getAllDepartments() {
        return departmentRepository.findAll();
    }
}