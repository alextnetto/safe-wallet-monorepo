import { Alert, Button, TextField } from '@mui/material'
import { Controller, FormProvider, useForm } from 'react-hook-form'
import { showNotification } from '@/store/notificationsSlice'
import { type GetSpaceResponse, useSpacesUpdateV1Mutation } from '@safe-global/store/gateway/AUTO_GENERATED/spaces'
import { useAppDispatch } from '@/store'
import { useIsAdmin } from '@/features/spaces/hooks/useSpaceMembers'
import { useState } from 'react'

type UpdateSpaceFormData = {
  name: string
}

const UpdateSpaceForm = ({ space }: { space: GetSpaceResponse | undefined }) => {
  const [error, setError] = useState<string>()
  const dispatch = useAppDispatch()
  const [updateSpace] = useSpacesUpdateV1Mutation()
  const isAdmin = useIsAdmin(space?.id)

  const formMethods = useForm<UpdateSpaceFormData>({
    mode: 'onChange',
    values: {
      name: space?.name || '',
    },
  })

  const isSubmitting = formMethods.formState.isSubmitting

  const { control, handleSubmit, watch } = formMethods

  const formName = watch('name')
  const isNameChanged = formName !== space?.name

  const onSubmit = handleSubmit(async (data) => {
    setError(undefined)

    if (!space) return

    try {
      await updateSpace({ id: space.id, updateSpaceDto: { name: data.name } })

      dispatch(
        showNotification({
          variant: 'success',
          message: 'Updated space name',
          groupKey: 'space-update-name',
        }),
      )
    } catch (e) {
      console.error(e)
      setError('Error updating the space. Please try again.')
    }
  })

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={onSubmit}>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Space name"
              fullWidth
              value={field.value || ''}
              slotProps={{ inputLabel: { shrink: true } }}
              onKeyDown={(e) => e.stopPropagation()}
            />
          )}
        />

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Button
          data-testid="space-save-button"
          variant="contained"
          type="submit"
          sx={{ mt: 2 }}
          disabled={!isNameChanged || !isAdmin || isSubmitting}
        >
          Save
        </Button>
      </form>
    </FormProvider>
  )
}

export default UpdateSpaceForm
