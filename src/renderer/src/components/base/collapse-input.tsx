import React, { useRef, useState, useCallback } from 'react'
import { Input, InputProps } from '@heroui/react'
import { FaSearch } from 'react-icons/fa'

interface CollapseInputProps extends Omit<InputProps, 'onValueChange'> {
  title: string
  onValueChange?: (value: string) => void
}

const CollapseInput: React.FC<CollapseInputProps> = (props) => {
  const { title, value, onValueChange, ...inputProps } = props
  const inputRef = useRef<HTMLInputElement>(null)
  const isComposingRef = useRef(false)
  const [localValue, setLocalValue] = useState(value || '')

  React.useEffect(() => {
    if (!isComposingRef.current) {
      setLocalValue(value || '')
    }
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setLocalValue(newValue)
      if (!isComposingRef.current) {
        onValueChange?.(newValue)
      }
    },
    [onValueChange]
  )

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true
  }, [])

  const handleCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLInputElement>) => {
      isComposingRef.current = false
      onValueChange?.(e.currentTarget.value)
    },
    [onValueChange]
  )

  return (
    <div className="flex">
      <Input
        size="sm"
        ref={inputRef}
        {...inputProps}
        value={localValue as string}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        style={{ paddingInlineEnd: 0 }}
        classNames={{
          inputWrapper: 'cursor-pointer bg-transparent p-0 data-[hover=true]:bg-content2',
          input: 'w-0 focus:w-[150px] focus:ml-2 transition-all duration-200'
        }}
        endContent={
          <div
            className="cursor-pointer p-2 text-lg text-foreground-500"
            onClick={(e) => {
              e.stopPropagation()
              if (inputRef.current?.offsetWidth != 0) {
                inputRef.current?.blur()
              } else {
                inputRef.current?.focus()
              }
            }}
          >
            <FaSearch title={title} />
          </div>
        }
        onClick={(e) => {
          e.stopPropagation()
          inputRef.current?.focus()
        }}
      />
    </div>
  )
}

export default CollapseInput
