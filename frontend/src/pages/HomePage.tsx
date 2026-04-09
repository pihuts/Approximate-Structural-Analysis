import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ArchitectureIcon from '@mui/icons-material/Architecture';
import ScienceIcon from '@mui/icons-material/Science';
import FunctionsIcon from '@mui/icons-material/Functions';
import { useNavigate } from 'react-router-dom';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <Box>
      {/* Hero Section */}
      <Paper
        sx={{
          p: { xs: 3, md: 5 },
          mb: 3,
          background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)',
          color: 'white',
          borderRadius: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <ArchitectureIcon sx={{ fontSize: 48 }} />
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Portal Frame Analysis
          </Typography>
        </Box>
        <Typography variant="h6" sx={{ mb: 1, opacity: 0.9 }}>
          Approximate Structural Analysis Tool
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, opacity: 0.85, maxWidth: 700 }}>
          Perform quick approximate analysis of portal frames using the Portal Method
          for lateral forces and gravity load distribution. Includes AISC steel design checks
          for beams and columns.
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<AnalyticsIcon />}
          onClick={() => navigate('/analysis')}
          sx={{
            bgcolor: 'white',
            color: 'primary.main',
            fontWeight: 600,
            px: 4,
            '&:hover': {
              bgcolor: '#E3F2FD',
            },
          }}
        >
          Start Analysis
        </Button>
      </Paper>

      {/* Features Grid */}
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        Features
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          {
            icon: <FunctionsIcon color="primary" sx={{ fontSize: 36 }} />,
            title: 'Portal Method',
            desc: 'Lateral force analysis using the portal method approximation for multi-storey frames.',
          },
          {
            icon: <ScienceIcon color="secondary" sx={{ fontSize: 36 }} />,
            title: 'Gravity Loads',
            desc: 'Distributed load analysis for beams including dead loads, live loads, and wall loads.',
          },
          {
            icon: <AnalyticsIcon color="primary" sx={{ fontSize: 36 }} />,
            title: 'Load Combinations',
            desc: 'LRFD load combinations per ASCE 7 for combined gravity and lateral loading.',
          },
          {
            icon: <ArchitectureIcon color="secondary" sx={{ fontSize: 36 }} />,
            title: 'AISC Design',
            desc: 'Steel beam and column design checks per AISC 360 with W-section selection.',
          },
        ].map((feature) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={feature.title}>
            <Card
              variant="outlined"
              sx={{
                height: '100%',
                transition: 'box-shadow 0.2s',
                '&:hover': {
                  boxShadow: 4,
                },
              }}
            >
              <CardContent>
                <Box sx={{ mb: 1 }}>{feature.icon}</Box>
                <Typography variant="subtitle1" gutterBottom>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.desc}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tech Stack */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Technology Stack
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {[
            'React 19',
            'TypeScript',
            'Material UI v5',
            'Vite',
            'KaTeX',
            'FastAPI (Backend)',
            'Julia (Engine)',
            'AISC 360',
          ].map((tech) => (
            <Chip key={tech} label={tech} size="small" variant="outlined" />
          ))}
        </Box>
      </Paper>
    </Box>
  );
}
