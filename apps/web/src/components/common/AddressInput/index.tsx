import AddressInputReadOnly from '@/components/common/AddressInputReadOnly'
import useAddressBook from '@/hooks/useAddressBook'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import type { ReactElement } from 'react'
import { useEffect, useCallback, useRef, useMemo } from 'react'
import {
  InputAdornment,
  TextField,
  type TextFieldProps,
  CircularProgress,
  IconButton,
  SvgIcon,
  Skeleton,
  Box,
} from '@mui/material'
import { useFormContext, Controller, useWatch, type Validate, get } from 'react-hook-form'
import { validatePrefixedAddress } from '@safe-global/utils/utils/validation'
import { useCurrentChain } from '@/hooks/useChains'
import useNameResolver from './useNameResolver'
import { cleanInputValue, parsePrefixedAddress } from '@safe-global/utils/utils/addresses'
import useDebounce from '@safe-global/utils/hooks/useDebounce'
import CaretDownIcon from '@/public/images/common/caret-down.svg'
import SaveAddressIcon from '@/public/images/common/save-address.svg'
import classnames from 'classnames'
import css from './styles.module.css'
import inputCss from '@/styles/inputs.module.css'
import Identicon from '../Identicon'
import { FEATURES, hasFeature } from '@safe-global/utils/utils/chains'

export type AddressInputProps = TextFieldProps & {
  name: string
  address?: string
  onOpenListClick?: () => void
  isAutocompleteOpen?: boolean
  validate?: Validate<string>
  deps?: string | string[]
  onAddressBookClick?: () => void
  chain?: Chain
  showPrefix?: boolean
  onReset?: () => void
}

const AddressInput = ({
  name,
  validate,
  required = true,
  onOpenListClick,
  isAutocompleteOpen,
  onAddressBookClick,
  deps,
  chain,
  showPrefix = true,
  onReset,
  ...props
}: AddressInputProps): ReactElement => {
  const {
    setValue,
    control,
    formState: { errors, isValidating },
    trigger,
  } = useFormContext()

  const currentChain = useCurrentChain()
  const rawValueRef = useRef<string>('')
  const currentShortName = chain?.shortName || currentChain?.shortName || ''

  // Watch the form value for ENS resolution and address book lookups
  const watchedValue = useWatch({ name, control })

  const addressBook = useAddressBook()

  // Fetch an ENS resolution for the current address
  const isDomainLookupEnabled = !!currentChain && hasFeature(currentChain, FEATURES.DOMAIN_LOOKUP)
  const { address, resolverError, resolving } = useNameResolver(isDomainLookupEnabled ? watchedValue : '')

  // errors[name] doesn't work with nested field names like 'safe.address', need to use the lodash get
  const fieldError = resolverError || get(errors, name)

  // Debounce the field error unless there's no error or it's resolving a domain
  let error = useDebounce(fieldError, 500)
  if (resolverError) error = resolverError
  if (!fieldError || resolving) error = undefined

  // Validation function based on the current chain prefix
  const validatePrefixed = useMemo(() => validatePrefixedAddress(currentShortName), [currentShortName])

  const transformAddressValue = useCallback(
    (value: string): string => {
      // Clean the input value
      const cleanValue = cleanInputValue(value)
      rawValueRef.current = cleanValue
      // This also checksums the address
      if (validatePrefixed(cleanValue) === undefined) {
        // if the prefix is correct we remove it from the value
        return parsePrefixedAddress(cleanValue).address
      } else {
        // we keep invalid prefixes such that the validation error is persistent
        return cleanValue
      }
    },
    [validatePrefixed],
  )

  // Update the input value
  const setAddressValue = useCallback(
    (value: string) => setValue(name, value, { shouldValidate: true }),
    [setValue, name],
  )

  // On ENS resolution, update the input value
  useEffect(() => {
    if (address) {
      // ENS resolution returns a pure address, don't add prefix
      rawValueRef.current = address
      setAddressValue(address)
    }
  }, [address, setAddressValue])

  // Retransform the value when chain changes
  useEffect(() => {
    if (address) return

    if (watchedValue && rawValueRef.current) {
      const transformedValue = transformAddressValue(rawValueRef.current)
      // Only update if the transformed value is different to avoid loops
      if (transformedValue !== watchedValue) {
        setAddressValue(transformedValue)
      }
    }
  }, [address, currentShortName, setAddressValue, transformAddressValue, watchedValue])

  const startAdornment = useMemo(
    () =>
      addressBook[watchedValue] ? (
        <AddressInputReadOnly address={watchedValue} showPrefix={showPrefix} chainId={chain?.chainId} />
      ) : (
        // Display the current short name in the adornment, unless the value contains the same prefix
        <InputAdornment position="end" sx={{ ml: 0 }}>
          <Box mr={1}>
            {watchedValue && !fieldError ? (
              <Identicon address={watchedValue} size={32} />
            ) : (
              <Skeleton variant="circular" width={32} height={32} animation={false} />
            )}
          </Box>

          {showPrefix && !rawValueRef.current.startsWith(`${currentShortName}:`) && <Box>{currentShortName}:</Box>}
        </InputAdornment>
      ),
    [addressBook, watchedValue, showPrefix, chain?.chainId, fieldError, currentShortName],
  )

  const endAdornment = (
    <InputAdornment position="end">
      {resolving || isValidating ? (
        <CircularProgress size={20} />
      ) : !props.disabled ? (
        <>
          {onAddressBookClick && (
            <IconButton onClick={onAddressBookClick}>
              <SvgIcon component={SaveAddressIcon} inheritViewBox fontSize="small" color="primary" />
            </IconButton>
          )}

          {onOpenListClick && (
            <IconButton
              onClick={onOpenListClick}
              className={classnames(css.openButton, { [css.rotated]: isAutocompleteOpen })}
              color="primary"
            >
              <SvgIcon component={CaretDownIcon} inheritViewBox fontSize="small" />
            </IconButton>
          )}
        </>
      ) : null}
    </InputAdornment>
  )

  const resetName = () => {
    if (!props.disabled && addressBook[watchedValue]) {
      rawValueRef.current = ''
      setValue(name, '', { shouldValidate: true })
      onReset?.()
    }
  }

  return (
    <Controller
      name={name}
      control={control}
      rules={{
        deps,
        required,
        validate: async () => {
          const value = rawValueRef.current
          if (value) {
            return validatePrefixed(value) || (await validate?.(parsePrefixedAddress(value).address))
          }
        },
      }}
      render={({ field }) => (
        <TextField
          {...props}
          className={inputCss.input}
          autoComplete="off"
          autoFocus={props.focused}
          label={<>{error?.message || props.label || `Recipient address${isDomainLookupEnabled ? ' or ENS' : ''}`}</>}
          error={!!error}
          fullWidth
          onClick={resetName}
          spellCheck={false}
          InputProps={{
            ...(props.InputProps || {}),
            className: addressBook[watchedValue] ? css.readOnly : undefined,
            startAdornment,
            endAdornment,
          }}
          InputLabelProps={{
            ...(props.InputLabelProps || {}),
            shrink: true,
          }}
          value={rawValueRef.current || field.value || ''}
          onChange={(e) => {
            const rawValue = e.target.value
            rawValueRef.current = cleanInputValue(rawValue)
            const transformedValue = transformAddressValue(rawValue)
            field.onChange(transformedValue)
          }}
          onBlur={() => {
            field.onBlur()
            // Workaround for a bug in react-hook-form that it restores a cached error state on blur
            setTimeout(() => trigger(name), 100)
          }}
        />
      )}
    />
  )
}

export default AddressInput
