package com.backend.controller;

import com.backend.dto.UserDTO;
import com.backend.service.RbacService;
import com.backend.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminControllerTests {

    @Test
    void getAllUsersWithoutAuthReturnsForbidden() {
        TestUserService userService = new TestUserService();
        TestRbacService rbacService = new TestRbacService();
        rbacService.failAuthorizationHeader = true;

        AdminController controller = createController(userService, rbacService);

        ResponseEntity<?> response = controller.getAllUsers(null, null);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals("missing auth", ((Map<?, ?>) response.getBody()).get("error"));
        assertFalse(userService.getAllUsersCalled);
    }

    @Test
    void getAllUsersWithUserIdHeaderReturnsUsers() {
        TestUserService userService = new TestUserService();
        TestRbacService rbacService = new TestRbacService();

        AdminController controller = createController(userService, rbacService);

        ResponseEntity<?> response = controller.getAllUsers(null, 1L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1L, rbacService.lastActorId);
        assertEquals(RbacService.PERM_USERS_MANAGE, rbacService.lastPermission);
        assertTrue(userService.getAllUsersCalled);

        List<?> users = (List<?>) response.getBody();
        assertEquals(1, users.size());
        assertEquals(10L, ((UserDTO) users.get(0)).getId());
    }

    private AdminController createController(UserService userService, RbacService rbacService) {
        AdminController controller = new AdminController();
        ReflectionTestUtils.setField(controller, "userService", userService);
        ReflectionTestUtils.setField(controller, "rbacService", rbacService);
        return controller;
    }

    private static class TestUserService extends UserService {
        private boolean getAllUsersCalled;

        @Override
        public List<UserDTO> getAllUsers() {
            getAllUsersCalled = true;
            UserDTO user = new UserDTO();
            user.setId(10L);
            user.setFullName("Nguyen Van A");
            return List.of(user);
        }
    }

    private static class TestRbacService extends RbacService {
        private boolean failAuthorizationHeader;
        private Long lastActorId;
        private String lastPermission;

        @Override
        public void requirePermission(Long userId, String permCode, String errorMessage) {
            lastActorId = userId;
            lastPermission = permCode;
        }

        @Override
        public void requirePermissionFromAuth(String authorizationHeader, String permCode, String errorMessage) {
            if (failAuthorizationHeader) {
                throw new SecurityException("missing auth");
            }
            lastPermission = permCode;
        }
    }
}
