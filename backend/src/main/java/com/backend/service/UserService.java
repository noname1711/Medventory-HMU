package com.backend.service;

import com.backend.dto.RegisterRequest;
import com.backend.dto.UserDTO;
import com.backend.entity.Department;
import com.backend.entity.Role;
import com.backend.entity.User;
import com.backend.entity.UserStatus;
import com.backend.repository.DepartmentRepository;
import com.backend.repository.RoleRepository;
import com.backend.repository.UserRepository;
import com.backend.repository.UserStatusRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class UserService {

    private static final String ROLE_BGH = "BGH";
    private static final String ROLE_LANH_DAO = "LANH_DAO";
    private static final String ROLE_THU_KHO = "THU_KHO";
    private static final String ROLE_CAN_BO = "CAN_BO";

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_APPROVED = "APPROVED";
    private static final String STATUS_REJECTED = "REJECTED"; // nếu DB có

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserStatusRepository userStatusRepository;

    public User findByEmail(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }

    public User registerUser(RegisterRequest request) {
        try {
            Department department = departmentRepository.findByName(request.getDepartment())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy khoa: " + request.getDepartment()
                            + ". Vui lòng chọn khoa có sẵn trong hệ thống."));

            String roleCode = mapRoleToCode(request.getRole());
            Role role = roleRepository.findByCode(roleCode)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy role code=" + roleCode));

            UserStatus pending = userStatusRepository.findByCode(STATUS_PENDING)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy user_status code=" + STATUS_PENDING));

            User user = new User();
            user.setFullName(request.getFullName());
            user.setEmail(request.getEmail());
            user.setPassword(request.getPassword());
            user.setDateOfBirth(request.getDateOfBirth());
            user.setDepartment(department);

            user.setRole(role);
            user.setStatus(pending);

            return userRepository.save(user);

        } catch (Exception e) {
            throw new RuntimeException("Lỗi đăng ký: " + e.getMessage(), e);
        }
    }

    public User authenticateUser(String email, String password) {
        Optional<User> userOpt = userRepository.findByEmailAndPassword(email, password);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            // giữ logic tương thích cũ: BGH được vào luôn; còn lại phải APPROVED
            if (user.isBanGiamHieu() || user.isApproved()) {
                return user;
            }
        }
        return null;
    }

    public List<UserDTO> getPendingUsers() {
        return userRepository.findAll()
                .stream()
                .filter(User::isPending)
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public List<UserDTO> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    // controller cũ gọi updateUserStatus(userId, "approved"/"pending")
    public boolean updateUserStatus(Long userId, String status) {
        return userRepository.findById(userId)
                .map(user -> {
                    String code = mapStatusToCode(status);
                    UserStatus st = userStatusRepository.findByCode(code)
                            .orElseThrow(() -> new RuntimeException("Không tìm thấy user_status code=" + code));
                    user.setStatus(st);
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

        if (user.getDepartment() != null) {
            dto.setDepartment(user.getDepartment().getName());
            dto.setDepartmentId(user.getDepartment().getId());
            dto.setDepartmentName(user.getDepartment().getName());
        } else {
            dto.setDepartment(null);
            dto.setDepartmentId(null);
            dto.setDepartmentName(null);
        }

        // DTO role là String
        dto.setRole(user.getRoleName());

        // DTO status là String
        dto.setStatus(user.getStatusName());

        // Backward-compatible fields cho FE cũ
        dto.setRoleCheck(roleCodeToRoleCheck(user.getRole() != null ? user.getRole().getCode() : null));
        dto.setStatusValue(statusCodeToInt(user.getStatus() != null ? user.getStatus().getCode() : null));

        dto.setIsApproved(user.isApproved());
        dto.setIsBanGiamHieu(user.isBanGiamHieu());
        dto.setIsLanhDao(user.isLanhDao());
        dto.setIsThuKho(user.isThuKho());
        dto.setIsCanBo(user.isCanBo());

        return dto;
    }

    public UserDTO getUserInfoByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found with email: " + email));
        return convertToDTO(user);
    }

    public UserDTO getUserInfoById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with ID: " + id));
        return convertToDTO(user);
    }

    public boolean emailExists(String email) {
        return userRepository.existsByEmail(email);
    }

    public boolean deleteUser(Long userId) {
        if (!userRepository.existsById(userId)) return false;
        userRepository.deleteById(userId);
        return true;
    }

    // controller cũ gọi updateUserRole(userId, "Thủ kho"/"Cán bộ"/...)
    public boolean updateUserRole(Long userId, String newRole) {
        return userRepository.findById(userId)
                .map(user -> {
                    String roleCode = mapRoleToCode(newRole);
                    Role role = roleRepository.findByCode(roleCode)
                            .orElseThrow(() -> new RuntimeException("Không tìm thấy role code=" + roleCode));
                    user.setRole(role);
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

    // ================= helpers =================

    private String mapRoleToCode(String roleStr) {
        String s = roleStr == null ? "" : roleStr.trim();
        String u = s.toUpperCase();

        // cho phép FE gửi luôn code
        if (ROLE_BGH.equals(u) || ROLE_LANH_DAO.equals(u) || ROLE_THU_KHO.equals(u) || ROLE_CAN_BO.equals(u)) {
            return u;
        }

        // map theo tiếng Việt / cách ghi khác
        String lower = s.toLowerCase();
        if (lower.contains("ban giám hiệu") || lower.contains("ban giam hieu") || lower.equals("bgh")) return ROLE_BGH;
        if (lower.contains("lãnh đạo") || lower.contains("lanh dao")) return ROLE_LANH_DAO;
        if (lower.contains("thủ kho") || lower.contains("thu kho")) return ROLE_THU_KHO;

        return ROLE_CAN_BO;
    }

    private String mapStatusToCode(String statusStr) {
        String s = statusStr == null ? "" : statusStr.trim().toLowerCase();
        if (s.equals("approved") || s.equals("1") || s.contains("duyệt") || s.contains("approved")) return STATUS_APPROVED;
        if (s.equals("rejected") || s.equals("2") || s.contains("từ chối") || s.contains("reject")) return STATUS_REJECTED;
        return STATUS_PENDING;
    }

    private int roleCodeToRoleCheck(String roleCode) {
        if (roleCode == null) return 3;
        String c = roleCode.trim().toUpperCase();
        if (ROLE_BGH.equals(c)) return 0;
        if (ROLE_LANH_DAO.equals(c)) return 1;
        if (ROLE_THU_KHO.equals(c)) return 2;
        return 3;
    }

    private int statusCodeToInt(String statusCode) {
        if (statusCode == null) return 0;
        return STATUS_APPROVED.equalsIgnoreCase(statusCode.trim()) ? 1 : 0;
    }
}
