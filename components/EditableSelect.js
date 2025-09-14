import { useState } from 'react';
import {
    TextField, MenuItem, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, Button, List, ListItem, ListItemText, ListItemSecondaryAction,
    Box, Typography, Chip
} from '@mui/material';
import { Edit, Delete, Add } from '@mui/icons-material';

const EditableSelect = ({
    label,
    value,
    onChange,
    options = [],
    field,
    onSaveOption,
    required = false,
    disabled = false
}) => {
    const [open, setOpen] = useState(false);
    const [newOption, setNewOption] = useState('');
    const [editingOptions, setEditingOptions] = useState([...options]);

    const handleAddOption = () => {
        if (newOption.trim() && !editingOptions.includes(newOption.trim())) {
            const updatedOptions = [...editingOptions, newOption.trim()];
            setEditingOptions(updatedOptions);
            setNewOption('');
        }
    };

    const handleDeleteOption = (optionToDelete) => {
        const updatedOptions = editingOptions.filter(option => option !== optionToDelete);
        setEditingOptions(updatedOptions);
    };

    const handleSave = () => {
        onSaveOption(field, editingOptions);
        setOpen(false);
    };

    const handleCancel = () => {
        setEditingOptions([...options]);
        setNewOption('');
        setOpen(false);
    };

    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                    select
                    label={label}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    fullWidth
                    required={required}
                    disabled={disabled}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                >
                    {options.map((option) => (
                        <MenuItem key={option} value={option}>
                            {option}
                        </MenuItem>
                    ))}
                </TextField>
                <IconButton
                    onClick={() => setOpen(true)}
                    color="primary"
                    disabled={disabled}
                    sx={{
                        bgcolor: 'primary.light',
                        '&:hover': { bgcolor: 'primary.main', color: 'white' },
                        borderRadius: 2
                    }}
                >
                    <Edit />
                </IconButton>
            </Box>

            <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Edit color="primary" />
                        Manage {label} Options
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Add new options or remove existing ones. Changes will be saved for this team.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <TextField
                                label={`New ${label}`}
                                value={newOption}
                                onChange={(e) => setNewOption(e.target.value)}
                                fullWidth
                                size="small"
                                onKeyPress={(e) => e.key === 'Enter' && handleAddOption()}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            />
                            <Button
                                onClick={handleAddOption}
                                variant="contained"
                                startIcon={<Add />}
                                sx={{ borderRadius: 2 }}
                            >
                                Add
                            </Button>
                        </Box>
                    </Box>

                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                        Current Options ({editingOptions.length})
                    </Typography>

                    {editingOptions.length === 0 ? (
                        <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                No options available. Add some options above.
                            </Typography>
                        </Box>
                    ) : (
                        <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                            {editingOptions.map((option, index) => (
                                <ListItem
                                    key={index}
                                    sx={{
                                        bgcolor: index % 2 === 0 ? 'grey.50' : 'white',
                                        borderRadius: 1,
                                        mb: 0.5
                                    }}
                                >
                                    <ListItemText
                                        primary={option}
                                        secondary={option === value ? 'Currently selected' : null}
                                    />
                                    <ListItemSecondaryAction>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            {option === value && (
                                                <Chip
                                                    label="Active"
                                                    color="primary"
                                                    size="small"
                                                />
                                            )}
                                            <IconButton
                                                onClick={() => handleDeleteOption(option)}
                                                color="error"
                                                size="small"
                                                disabled={option === value}
                                            >
                                                <Delete />
                                            </IconButton>
                                        </Box>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={handleCancel} sx={{ borderRadius: 2 }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        variant="contained"
                        sx={{ borderRadius: 2 }}
                    >
                        Save Changes
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default EditableSelect;