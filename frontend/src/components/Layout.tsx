import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ArchitectureIcon from '@mui/icons-material/Architecture';
import { useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const DRAWER_WIDTH = 240;

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  text: string;
  icon: ReactNode;
  path: string;
}

const navItems: NavItem[] = [
  { text: 'Home', icon: <HomeIcon />, path: '/' },
  { text: 'Analysis', icon: <AnalyticsIcon />, path: '/analysis' },
];

function DrawerContent({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (path: string) => {
    navigate(path);
    onClose?.();
  };

  return (
    <Box>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ArchitectureIcon color="primary" />
        <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
          Portal Frame
        </Typography>
      </Box>
      <Divider />
      <List sx={{ pt: 1 }}>
        {navItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNav(item.path)}
              sx={{
                borderRadius: 1,
                mx: 1,
                mb: 0.5,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} sx={{ '& .MuiTypography-root': { fontWeight: 500 } }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

export function Layout({ children }: LayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />

      {/* App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: isMobile ? '100%' : `calc(100% - ${DRAWER_WIDTH}px)`,
          ml: isMobile ? 0 : `${DRAWER_WIDTH}px`,
          bgcolor: 'white',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setMobileOpen(!mobileOpen)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
            Portal Frame Analysis
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Approximate Structural Analysis Tool
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Sidebar - Desktop */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          <Toolbar />
          <DrawerContent />
        </Drawer>
      )}

      {/* Sidebar - Mobile */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
            },
          }}
        >
          <DrawerContent onClose={() => setMobileOpen(false)} />
        </Drawer>
      )}

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: isMobile ? '100%' : `calc(100% - ${DRAWER_WIDTH}px)`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Toolbar />
        <Box sx={{ flex: 1, p: { xs: 2, sm: 3 } }}>
          {children}
        </Box>

        {/* Footer */}
        <Box
          component="footer"
          sx={{
            py: 1.5,
            px: 3,
            borderTop: '1px solid',
            borderColor: 'divider',
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Portal Frame Analysis Tool v1.0 | Approximate Structural Analysis | Built with React + MUI
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
