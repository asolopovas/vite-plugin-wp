import { registerBlockType } from '@wordpress/blocks'
import { useRef, useEffect } from '@wordpress/element'
import { InspectorControls, useBlockProps } from '@wordpress/block-editor'
import { PanelBody } from '@wordpress/components'

export function useSetBlockIdEffect(clientId: string, setAttributes: Function) {
    useEffect(() => {
        setAttributes({ blockId: clientId })
    }, [clientId])
}

export const meta = {
    name: 'test/block',
    title: 'TestBlock',
    icon: 'smiley' as const,
    apiVersion: 3,
    category: 'layout',
}

export const edit = ({ clientId, attributes, setAttributes }: any) => {
    const { blockId } = attributes
    useSetBlockIdEffect(clientId, setAttributes)
    const containerRef = useRef<HTMLElement>(null)
    const isDev = import.meta.env.DEV

    const blockProps = useBlockProps({
        className: `test-block-id-${ blockId } hmr-test${ isDev ? ' development-mode dev' : '' }`,
        ref: containerRef,
        ...(isDev ? { 'data-vite-mode': 'development' } : {}),
    })

    return (
        <>
            <InspectorControls>
                <PanelBody title={ 'Test Panel' } initialOpen={ true }>
                    <div>Test Panel Body</div>
                </PanelBody>
            </InspectorControls>
            <div { ...blockProps }>Test Block</div>
        </>
    )
}

export const save = ({ attributes }: any) => {
    const { blockId } = attributes
    const blockProps = useBlockProps.save({
        className: `test-block-id-${ blockId }`,
    })
    return (<div { ...blockProps }>Save Block</div>)
}

registerBlockType(meta.name, {
    ...meta,
    attributes: {
        blockId: { type: 'string', default: 'test' },
        layout:  { type: 'string', default: 'content' },
        test:    { type: 'string', default: 'test' },
        __hmrTimestamp: { type: 'number', default: 0 },
    },
    edit,
    save,
})
